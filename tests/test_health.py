def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "target_classes" in data
    assert len(data["target_classes"]) == 6
    assert data["target_classes"] == ["Bronchiectasis", "Bronchiolitis", "COPD", "Healthy", "Pneumonia", "URTI"]
