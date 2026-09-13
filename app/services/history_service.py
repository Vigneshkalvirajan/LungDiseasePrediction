import json
import sqlite3
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any

from app.models.patient import PatientInfo
from app.models.prediction import PredictionResult
from app.models.report import RespiratoryReport

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent.parent / "voxmed_history.db"

class HistoryService:
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or DB_PATH
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(str(self.db_path))
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS analysis_history (
                    id TEXT PRIMARY KEY,
                    created_at TEXT NOT NULL,
                    visit_date TEXT,
                    patient_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    age INTEGER NOT NULL,
                    gender TEXT NOT NULL,
                    mobile_number TEXT,
                    dob TEXT,
                    audio_filename TEXT,
                    predicted_class TEXT NOT NULL,
                    confidence REAL NOT NULL,
                    probabilities TEXT NOT NULL,
                    report TEXT,
                    status TEXT DEFAULT 'completed'
                )
            """)
            conn.commit()

            # Auto-migrate if table existed without visit_date
            cursor = conn.execute("PRAGMA table_info(analysis_history)")
            cols = [col[1] for col in cursor.fetchall()]
            if "visit_date" not in cols:
                conn.execute("ALTER TABLE analysis_history ADD COLUMN visit_date TEXT")
                conn.commit()
        except Exception as e:
            logger.error(f"Error initializing SQLite history database: {e}")
        finally:
            conn.close()

    def create_record(
        self,
        patient: PatientInfo,
        prediction: PredictionResult,
        report: Optional[RespiratoryReport] = None,
        audio_filename: Optional[str] = None,
        status_text: str = "completed"
    ) -> Dict[str, Any]:
        record_id = str(uuid.uuid4())
        created_at = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
        visit_date = patient.visit_date or datetime.utcnow().strftime("%Y-%m-%d")

        prob_json = json.dumps(prediction.probabilities)
        report_json = json.dumps(report.model_dump()) if report else None

        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            conn.execute("""
                INSERT INTO analysis_history (
                    id, created_at, visit_date, patient_id, name, age, gender, mobile_number, dob,
                    audio_filename, predicted_class, confidence, probabilities, report, status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record_id,
                created_at,
                visit_date,
                patient.patient_id,
                patient.name,
                patient.age,
                patient.gender,
                patient.mobile_number,
                patient.dob,
                audio_filename,
                prediction.predicted_class,
                prediction.confidence,
                prob_json,
                report_json,
                status_text
            ))
            conn.commit()
        finally:
            conn.close()

        return self.get_record(record_id)

    def list_records(self, limit: int = 100, patient_id: Optional[str] = None) -> List[Dict[str, Any]]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            if patient_id and patient_id.strip():
                cursor = conn.execute("""
                    SELECT id, created_at, visit_date, patient_id, name, age, gender, mobile_number, dob,
                           audio_filename, predicted_class, confidence, probabilities, status
                    FROM analysis_history
                    WHERE patient_id = ? OR patient_id LIKE ?
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (patient_id.strip(), f"%{patient_id.strip()}%", limit))
            else:
                cursor = conn.execute("""
                    SELECT id, created_at, visit_date, patient_id, name, age, gender, mobile_number, dob,
                           audio_filename, predicted_class, confidence, probabilities, status
                    FROM analysis_history
                    ORDER BY created_at DESC
                    LIMIT ?
                """, (limit,))
            rows = cursor.fetchall()
            
            results = []
            for row in rows:
                item = dict(row)
                try:
                    item["probabilities"] = json.loads(item["probabilities"])
                except Exception:
                    item["probabilities"] = {}
                results.append(item)
            return results
        finally:
            conn.close()

    def get_patient_previous_visits(self, patient_id: str, exclude_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves all previous historical records for a specific patient, ordered with most recent visit first."""
        if not patient_id or not patient_id.strip():
            return []
        
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            if exclude_id:
                cursor = conn.execute("""
                    SELECT id, created_at, visit_date, patient_id, name, predicted_class, confidence, status
                    FROM analysis_history
                    WHERE patient_id = ? AND id != ?
                    ORDER BY created_at DESC
                """, (patient_id.strip(), exclude_id))
            else:
                cursor = conn.execute("""
                    SELECT id, created_at, visit_date, patient_id, name, predicted_class, confidence, status
                    FROM analysis_history
                    WHERE patient_id = ?
                    ORDER BY created_at DESC
                """, (patient_id.strip(),))
            rows = cursor.fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()

    def get_patient_identity(self, patient_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves registered patient identity and demographics by patient_id."""
        if not patient_id or not patient_id.strip():
            return None
        
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute("""
                SELECT patient_id, name, age, gender, mobile_number, dob
                FROM analysis_history
                WHERE LOWER(TRIM(patient_id)) = LOWER(TRIM(?))
                ORDER BY created_at DESC
                LIMIT 1
            """, (patient_id.strip(),))
            row = cursor.fetchone()
            if not row:
                return None
            return dict(row)
        finally:
            conn.close()

    def get_record(self, record_id: str) -> Optional[Dict[str, Any]]:
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        try:
            cursor = conn.execute("""
                SELECT * FROM analysis_history WHERE id = ?
            """, (record_id,))
            row = cursor.fetchone()
            if not row:
                return None
            
            item = dict(row)
            try:
                item["probabilities"] = json.loads(item["probabilities"])
            except Exception:
                item["probabilities"] = {}
            if item.get("report"):
                try:
                    item["report"] = json.loads(item["report"])
                except Exception:
                    pass
            return item
        finally:
            conn.close()

history_service = HistoryService()
