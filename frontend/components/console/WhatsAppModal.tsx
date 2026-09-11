"use client";

import React, { useState } from "react";
import { PatientInfo, PredictionResult, RespiratoryReport, WhatsAppLanguage } from "../../types";
import { generateClinicalReportPdf } from "../../services/pdfService";

interface WhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientInfo | {
    patient_id: string;
    name: string;
    age: number;
    gender: string;
    mobile_number?: string;
    dob?: string;
    visit_date?: string;
  };
  prediction: PredictionResult | null;
  report: RespiratoryReport | null;
}

interface DiseaseAdvice {
  name: string;
  whatIsIt: string;
  causes: string;
  dos: string[];
  donts: string[];
}

const LANGUAGE_CONTENT: Record<WhatsAppLanguage, Record<string, DiseaseAdvice>> = {
  en: {
    COPD: {
      name: "Chronic Obstructive Pulmonary Disease (COPD / Long-term Airway Swelling)",
      whatIsIt: "A condition where breathing tubes become narrow and swollen, making it harder to breathe out air comfortably.",
      causes: "Smoking, air pollution, smoke from firewood/chulhas, dust, and previous lung infections.",
      dos: [
        "Take prescribed inhalers and medicines on time without skipping.",
        "Do gentle breathing exercises and drink plenty of warm water.",
        "Eat nutritious, freshly cooked warm food.",
      ],
      donts: [
        "DO NOT smoke or stay near people smoking.",
        "DO NOT go near dust, mosquito coils, or burning garbage.",
        "DO NOT ignore sudden breathlessness or high fever — consult your doctor immediately.",
      ],
    },
    Pneumonia: {
      name: "Pneumonia (Lung Infection)",
      whatIsIt: "An infection in the lungs that causes the air sacs to fill with fluid or phlegm.",
      causes: "Bacterial or viral infections caught from severe cold, flu, or low immunity.",
      dos: [
        "Complete the full course of prescribed antibiotics / medicines.",
        "Get plenty of bed rest and drink warm liquids, soups, and warm water.",
        "Sleep with your head slightly raised for easier breathing.",
      ],
      donts: [
        "DO NOT stop medicines early even if you feel better after a few days.",
        "DO NOT do heavy physical work until fully recovered.",
        "DO NOT expose yourself to cold weather without warm clothing.",
      ],
    },
    Bronchiectasis: {
      name: "Bronchiectasis (Widened Airway & Mucus Buildup)",
      whatIsIt: "Permanent widening of lung airways where thick mucus gathers and needs to be cleared regularly.",
      causes: "Past severe chest infections, childhood pneumonia, or weakened airway defense.",
      dos: [
        "Practice daily chest clearing and coughing techniques taught by your clinic.",
        "Drink lots of warm water throughout the day to keep mucus thin.",
        "Stay up to date with doctor-recommended vaccinations.",
      ],
      donts: [
        "DO NOT swallow or suppress cough when phlegm comes up.",
        "DO NOT stay in damp or unventilated dusty rooms.",
      ],
    },
    Bronchiolitis: {
      name: "Bronchiolitis (Small Airway Swelling)",
      whatIsIt: "Swelling and mucus congestion in the smallest breathing tubes of the lungs.",
      causes: "Common respiratory viral infections spread through colds or seasonal changes.",
      dos: [
        "Keep breathing air moist using steam inhalation or a humidifier.",
        "Drink small, frequent sips of warm water and fluids.",
        "Keep the patient rested and sitting in an upright comfortable position.",
      ],
      donts: [
        "DO NOT expose the patient to any cigarette or cooking smoke.",
        "DO NOT give over-the-counter cough syrups without a doctor's prescription.",
      ],
    },
    URTI: {
      name: "Upper Respiratory Tract Infection (Cold / Throat / Flu Infection)",
      whatIsIt: "A mild infection affecting the nose, throat, sinuses, or vocal cords.",
      causes: "Common cold viruses, seasonal weather changes, or dust allergy.",
      dos: [
        "Gargle with warm salt water 2 to 3 times a day.",
        "Inhale steam to clear blocked nasal passages.",
        "Rest well and eat light, easily digestible warm meals.",
      ],
      donts: [
        "DO NOT consume ice-cold drinks or refrigerated food.",
        "DO NOT go out in cold night air without a scarf or mask.",
      ],
    },
    Healthy: {
      name: "Healthy Lungs (Clear Breathing)",
      whatIsIt: "Normal and clear breathing sounds detected with no signs of lung obstruction or infection.",
      causes: "Healthy respiratory system and clean airways.",
      dos: [
        "Continue regular walking, deep breathing, and physical exercise.",
        "Maintain a healthy balanced diet with fresh fruits and vegetables.",
        "Stay well hydrated every day.",
      ],
      donts: [
        "DO NOT take up smoking or tobacco products.",
        "DO NOT stay in unventilated rooms filled with smoke or chemical fumes.",
      ],
    },
  },
  ta: {
    COPD: {
      name: "சி.ஓ.பி.டி (நீண்டகால சுவாசப்பாதை வீக்கம் / அடைப்பு)",
      whatIsIt: "நுரையீரலின் காற்று குழாய்கள் சுருங்கி சளி சேருவதால் மூச்சு விடுவதில் சிரமம் ஏற்படும் நிலை.",
      causes: "புகைபிடித்தல், விறகு அடுப்பு புகை, தூசு, காற்று மாசுபாடு மற்றும் பழைய நுரையீரல் தொற்று.",
      dos: [
        "மருத்துவர் பரிந்துரைத்த இன்ஹேலர் மற்றும் மருந்துகளை சரியான நேரத்திற்கு எடுத்துக்கொள்ளவும்.",
        "தினமும் லேசான மூச்சுப் பயிற்சி செய்து, வெதுவெதுப்பான நீர் நிறைய குடிக்கவும்.",
        "சத்தான வீட்டு உணவுகளை உட்கொள்ளவும்.",
      ],
      donts: [
        "புகைபிடிக்கக் கூடாது; மற்றவர்கள் புகைக்கும் இடத்திற்கும் செல்ல வேண்டாம்.",
        "தூசு, கொசுவர்த்தி புகை மற்றும் குப்பை எரியும் இடங்களுக்கு செல்ல வேண்டாம்.",
        "மூச்சுத் திணறல் அதிகமானால் உடனே மருத்துவரை அணுகவும்.",
      ],
    },
    Pneumonia: {
      name: "நிமோனியா (நுரையீரல் தொற்று நோய்)",
      whatIsIt: "நுரையீரலில் கிருமி தொற்று ஏற்பட்டு சளி மற்றும் நீர் கோர்த்துக்கொள்ளும் நிலை.",
      causes: "பாக்டீரியா அல்லது வைரஸ் கிருமிகள், கடுமையான சளி, நோய் எதிர்ப்பு சக்தி குறைவு.",
      dos: [
        "மருத்துவர் தந்த மாத்திரைகளை இடைவிடாமல் முழுமையாக முடிக்கவும்.",
        "நல்ல ஓய்வு எடுத்து, சூடான கஞ்சி, சூப் மற்றும் வெந்நீர் அருந்தவும்.",
        "படுக்கும்போது தலையை சற்று உயரமாக வைத்து படுக்கவும்.",
      ],
      donts: [
        "குணம் தெரிந்தது போல் இருந்தாலும் மாத்திரைகளை பாதியில் நிறுத்தக் கூடாது.",
        "உடல் நலம் தேறும் வரை கடுமையான வேலைகளை செய்ய வேண்டாம்.",
        "குளிர்ந்த நீரில் குளிப்பதையோ அல்லது பனி காற்றில் செல்வதையோ தவிர்க்கவும்.",
      ],
    },
    Bronchiectasis: {
      name: "மூச்சுக்குழாய் விரிவடைதல் மற்றும் சளி தேக்கம்",
      whatIsIt: "நுரையீரலின் காற்று குழாய்கள் விரிவடைந்து அதிக அளவு சளி தேங்கும் நிலை.",
      causes: "நீண்ட நாள் மாறாத சளி, முந்தைய தீவிர நெஞ்சு தொற்று.",
      dos: [
        "தினமும் சளியை வெளியேற்றும் எளிய உடற்பயிற்சிகளை செய்யவும்.",
        "சளி இளகி எளிதில் வெளியேற வெந்நீர் அதிகம் குடிக்கவும்.",
      ],
      donts: [
        "வரும் சளியை விழுங்கவோ அல்லது அடக்கவோ கூடாது.",
        "ஈரப்பதமான, தூசு நிறைந்த அறைகளில் தங்க வேண்டாம்.",
      ],
    },
    Bronchiolitis: {
      name: "மூச்சு நுண்குழாய் அழற்சி (சிறு காற்றுக்குழாய் வீக்கம்)",
      whatIsIt: "நுரையீரலின் மிகச்சிறிய காற்று குழாய்களில் ஏற்படும் வீக்கம் மற்றும் சளி அடைப்பு.",
      causes: "வைரஸ் தொற்று மற்றும் பருவகால சளி.",
      dos: [
        "ஆவி பிடிக்கவும் (Steam inhalation) மற்றும் வெதுவெதுப்பான நீர் புகட்டவும்.",
        "நோயாளிக்கு நல்ல ஓய்வு கொடுத்து தலையை சற்று உயர்த்தி வைக்கவும்.",
      ],
      donts: [
        "சமையல் புகை அல்லது சிகரெட் புகை இருக்கும் இடத்திற்கு அருகில் விட வேண்டாம்.",
        "மருத்துவர் ஆலோசனையின்றி கண்ட இருமல் மருந்துகளை கொடுக்கக் கூடாது.",
      ],
    },
    URTI: {
      name: "மேல் சுவாசக்குழாய் தொற்று (சாதாரண சளி, தொண்டை வலி, காய்ச்சல்)",
      whatIsIt: "மூக்கு மற்றும் தொண்டை பகுதியில் ஏற்படும் லேசான சளி/வைரஸ் தொற்று.",
      causes: "சீதோஷ்ண நிலை மாற்றம், குளிர்ந்த காற்று, வைரஸ் தொற்று.",
      dos: [
        "வெதுவெதுப்பான உப்பு நீரில் தினமும் 2-3 முறை தொண்டை கொப்பளிக்கவும்.",
        "ஆவி பிடித்து தொண்டைக்கு இதமான சூடான உணவுகளை சாப்பிடவும்.",
      ],
      donts: [
        "குளிர்சாதன பெட்டி (Fridge) நீர் மற்றும் ஐஸ்கிரீம் போன்றவற்றை தவிர்க்கவும்.",
        "பனிக்காற்றில் தலைக்கு துணி அணியாமல் செல்ல வேண்டாம்.",
      ],
    },
    Healthy: {
      name: "ஆரோக்கியமான நுரையீரல் (இயல்பு நிலை)",
      whatIsIt: "நுரையீரலில் எந்த அடைப்போ அல்லது நோய்த்தொற்றோ இல்லை; மூச்சொலி முற்றிலும் ஆரோக்கியமாக உள்ளது.",
      causes: "ஆரோக்கியமான நுரையீரல் மற்றும் சுத்தமான காற்றுப்பாதை.",
      dos: [
        "தினமும் நடைபயிற்சி மற்றும் ஆழ்ந்த மூச்சுப் பயிற்சி செய்யவும்.",
        "நிறைய தண்ணீர் குடித்து சத்தான காய்கறிகளை சாப்பிடவும்.",
      ],
      donts: [
        "புகைபிடித்தல் பழக்கத்தை எப்போதும் தொடங்க வேண்டாம்.",
        "அதிக புகை மற்றும் தூசு நிறைந்த இடங்களில் மாஸ்க் அணியாமல் செல்ல வேண்டாம்.",
      ],
    },
  },
  hi: {
    COPD: {
      name: "सीओपीडी (फेफड़ों की सांस नली में पुरानी सूजन/रुकावट)",
      whatIsIt: "फेफड़ों की सांस की नलियों का सिकुड़ जाना, जिससे सांस बाहर छोड़ने में तकलीफ होती है।",
      causes: "बीड़ी/सिगरेट पीना, चूल्हे का धुआं, धूल-मिट्टी और पुराना फेफड़ों का संक्रमण।",
      dos: [
        "डॉक्टर द्वारा दिया गया इन्हेलर और दवाइयां समय पर लें।",
        "रोजाना हल्का प्राणायाम या सांस का व्यायाम करें और गुनगुना पानी पिएं।",
        "पौष्टिक और सुपाच्य भोजन लें।",
      ],
      donts: [
        "बीड़ी, सिगरेट या किसी भी धुएं के पास बिल्कुल न जाएं।",
        "धूल-मिट्टी और प्रदूषण वाले स्थानों पर मास्क के बिना न जाएं।",
        "सांस ज्यादा फूलने पर तुरंत डॉक्टर को दिखाएं।",
      ],
    },
    Pneumonia: {
      name: "निमोनिया (फेफड़ों का इन्फेक्शन)",
      whatIsIt: "फेफड़ों में बैक्टीरिया या वायरस से होने वाला इन्फेक्शन जिसमें कफ और पानी भर जाता है।",
      causes: "सर्दी-जुकाम बिगड़ना, कमजोर रोग प्रतिरोधक क्षमता या बैक्टीरिया का संक्रमण।",
      dos: [
        "डॉक्टर द्वारा लिखी गई एंटीबायोटिक दवाइयों का पूरा कोर्स करें।",
        "पूरा आराम करें और गुनगुना पानी, सूप या पतली खिचड़ी लें।",
        "सोते समय सिर को थोड़ा ऊंचा रखें ताकि सांस आसानी से आए।",
      ],
      donts: [
        "आराम महसूस होने पर भी दवा बीच में न छोड़ें।",
        "ठीक होने तक कोई भारी काम या मेहनत न करें।",
        "ठंडी हवा और ठंडे पानी से बचें।",
      ],
    },
    Bronchiectasis: {
      name: "ब्रोंकिइक्टेसिस (सांस की नली का चौड़ा होना व कफ जमना)",
      whatIsIt: "फेफड़ों की नलियों का ढीला होना जिसमें गाढ़ा कफ जमा हो जाता है।",
      causes: "बचपन का पुराना निमोनिया या बार-बार होने वाला छाती का संक्रमण।",
      dos: [
        "कफ निकालने के लिए बताए गए छाती के व्यायाम नियमित रूप से करें।",
        "कफ पतला करने के लिए दिनभर गुनगुना पानी पीते रहें।",
      ],
      donts: [
        "आने वाले कफ या बलगम को अंदर न रोकें।",
        "सीलन या धूल भरी जगह में न रहें।",
      ],
    },
    Bronchiolitis: {
      name: "ब्रोंकियोलाइटिस (छोटी सांस नलियों की सूजन)",
      whatIsIt: "फेफड़ों की सबसे छोटी सांस नलियों में सूजन और बलगम की रुकावट।",
      causes: "वायरल संक्रमण जो मौसम बदलने पर फैलता है।",
      dos: [
        "भाप (Steam) दिलाएं और मरीज को घूंट-घूंट करके गुनगुना पानी दें।",
        "मरीज को आराम कराएं और पीठ को थोड़ा सीधा रखें।",
      ],
      donts: [
        "चूल्हे या सिगरेट के धुएं के पास मरीज को न ले जाएं।",
        "बिना डॉक्टर की सलाह के कोई कफ सिरप न दें।",
      ],
    },
    URTI: {
      name: "ऊपरी श्वास नलिका संक्रमण (सामान्य जुकाम, गला खराब, फ्लू)",
      whatIsIt: "नाक और गले का सामान्य मौसमी संक्रमण।",
      causes: "ठंडा-गरम होना, मौसम बदलना, धूल या जुकाम का वायरस।",
      dos: [
        "गुनगुने नमक के पानी से दिन में 2-3 बार गरारे करें।",
        "भाप लें और हल्का गर्म खाना खाएं।",
      ],
      donts: [
        "फ्रिज का ठंडा पानी, बर्फ और कोल्ड ड्रिंक्स बिल्कुल न लें।",
        "रात की ठंडी हवा में बिना गर्म कपड़े के न निकलें।",
      ],
    },
    Healthy: {
      name: "स्वस्थ फेफड़े (सामान्य स्थिति)",
      whatIsIt: "फेफड़ों में किसी भी प्रकार का संक्रमण या रुकावट नहीं है; सांस की आवाज पूरी तरह सामान्य है।",
      causes: "स्वस्थ फेफड़े और साफ सांस नलिकाएं।",
      dos: [
        "नियमित टहलें, प्राणायाम करें और ताजी हवा में सांस लें।",
        "हरी सब्जियां, फल और पर्याप्त पानी का सेवन करें।",
      ],
      donts: [
        "धूम्रपान (बीड़ी/सिगरेट) कभी न करें।",
        "धूल-धुएं वाली जगहों पर सुरक्षा बरतें।",
      ],
    },
  },
};

export function WhatsAppModal({
  isOpen,
  onClose,
  patient,
  prediction,
  report,
}: WhatsAppModalProps) {
  const [language, setLanguage] = useState<WhatsAppLanguage>("en");
  const [selectedOption, setSelectedOption] = useState<"patient" | "different">("patient");
  const [alternateNumber, setAlternateNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusStep, setStatusStep] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const patientNumber = patient.mobile_number?.trim() || "";
  const hasPatientNumber = Boolean(patientNumber);

  function validatePhoneNumber(num: string): boolean {
    const digits = num.replace(/\D/g, "");
    return digits.length >= 7;
  }

  function cleanNumberForWhatsApp(num: string): string {
    let digits = num.replace(/\D/g, "");
    if (digits.startsWith("00")) {
      digits = digits.substring(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      digits = "91" + digits.substring(1);
    } else if (digits.length === 10) {
      digits = "91" + digits;
    }
    return digits;
  }

  // Construct Layman friendly message
  function constructMessage(lang: WhatsAppLanguage): string {
    const predClass = prediction?.predicted_class || "Healthy";
    const advice =
      LANGUAGE_CONTENT[lang][predClass] || LANGUAGE_CONTENT[lang]["Healthy"];
    const displayVisitDate = patient.visit_date || new Date().toLocaleDateString("en-GB");

    // Longitudinal progress note if returning patient
    let progressNote = "";
    if (report?.longitudinal_progression?.is_returning_patient) {
      const prog = report.longitudinal_progression;
      if (lang === "ta") {
        progressNote = `\n🔄 *முந்தைய மருத்துவ வருகை ஒப்பீடு:*\n• முந்தைய நாள்: ${prog.previous_visit_date || "முந்தைய பதிவு"} (${prog.previous_diagnosis})\n• தற்போதைய நிலை: ${prog.trend === "cured" || prog.trend === "improved" ? "உடல்நலம் தேறியுள்ளது / குணமாகியுள்ளது" : "தொடர் கவனிப்பு தேவை"}\n• ${prog.progression_summary || ""}\n`;
      } else if (lang === "hi") {
        progressNote = `\n🔄 *पिछली जांच से तुलना:*\n• पिछली तारीख: ${prog.previous_visit_date || "पिछला रिकॉर्ड"} (${prog.previous_diagnosis})\n• वर्तमान स्थिति: ${prog.trend === "cured" || prog.trend === "improved" ? "स्वास्थ्य में सुधार / रोगमुक्त" : "लगातार देखभाल की आवश्यकता"}\n• ${prog.progression_summary || ""}\n`;
      } else {
        progressNote = `\n🔄 *Previous Visit Health Comparison:*\n• Previous Record: ${prog.previous_visit_date || "Earlier visit"} (${prog.previous_diagnosis})\n• Current Status: ${prog.trend === "cured" || prog.trend === "improved" ? "Condition Cured / Improved" : "Ongoing Monitoring Required"}\n• ${prog.progression_summary || ""}\n`;
      }
    }

    if (lang === "ta") {
      return [
        `🏥 *RespiraAI – நுரையீரல் பரிசோதனை அறிக்கை*`,
        `═══════════════════════`,
        `👤 *நோயாளி பெயர்:* ${patient.name}`,
        `🆔 *நோயாளி எண் (ID):* ${patient.patient_id}`,
        `📅 *பரிசோதனை நாள்:* ${displayVisitDate}`,
        `═══════════════════════`,
        `🔍 *கண்டறியப்பட்ட நிலை:*`,
        `👉 *${advice.name}*`,
        "",
        `📖 *இது என்ன பாதிப்பு?*`,
        `${advice.whatIsIt}`,
        "",
        `❓ *இதன் முக்கிய காரணங்கள்:*`,
        `${advice.causes}`,
        progressNote,
        `✅ *செய்ய வேண்டியவை (Do's):*`,
        ...advice.dos.map((d) => `• ${d}`),
        "",
        `❌ *செய்யக்கூடாதவை (Don'ts):*`,
        ...advice.donts.map((d) => `• ${d}`),
        "",
        `═══════════════════════`,
        `📄 *மருத்துவ PDF அறிக்கை:*`,
        `உங்களின் முழுமையான மருத்துவ PDF அறிக்கை தயாரிக்கப்பட்டு இணைக்கப்பட்டுள்ளது. தயவுசெய்து உங்கள் மருத்துவரிடம் காண்பிக்கவும்.`,
        `═══════════════════════`,
        `⚠️ *முக்கிய குறிப்பு:* இது AI அடிப்படையிலான ஆரம்ப பரிசோதனை அறிக்கை. மருத்துவரின் நேரடி ஆலோசனை மிகவும் அவசியமாகும்.`,
      ].join("\n");
    }

    if (lang === "hi") {
      return [
        `🏥 *RespiraAI – फेफड़ों की जांच रिपोर्ट*`,
        `═══════════════════════`,
        `👤 *मरीज का नाम:* ${patient.name}`,
        `🆔 *मरीज आईडी (ID):* ${patient.patient_id}`,
        `📅 *जांच की तारीख:* ${displayVisitDate}`,
        `═══════════════════════`,
        `🔍 *जांच में पाई गई स्थिति:*`,
        `👉 *${advice.name}*`,
        "",
        `📖 *यह क्या बीमारी है?*`,
        `${advice.whatIsIt}`,
        "",
        `❓ *इसके मुख्य कारण:*`,
        `${advice.causes}`,
        progressNote,
        `✅ *क्या करें (Do's):*`,
        ...advice.dos.map((d) => `• ${d}`),
        "",
        `❌ *क्या न करें (Don'ts):*`,
        ...advice.donts.map((d) => `• ${d}`),
        "",
        `═══════════════════════`,
        `📄 *अस्पताल की विस्तृत PDF रिपोर्ट:*`,
        `आपकी पूरी मेडिकल PDF रिपोर्ट तैयार करके संलग्न की गई है। कृपया इसे अपने डॉक्टर को अवश्य दिखाएं।`,
        `═══════════════════════`,
        `⚠️ *सलाह:* यह एक AI आधारित प्रारंभिक जांच रिपोर्ट है। डॉक्टर की व्यक्तिगत सलाह और जांच सर्वोपरि है।`,
      ].join("\n");
    }

    // Default English
    return [
      `🏥 *RespiraAI – Respiratory Health Report*`,
      `═══════════════════════`,
      `👤 *Patient Name:* ${patient.name}`,
      `🆔 *Patient ID (MRN):* ${patient.patient_id}`,
      `📅 *Date of Visit:* ${displayVisitDate}`,
      `═══════════════════════`,
      `🔍 *Identified Condition:*`,
      `👉 *${advice.name}*`,
      "",
      `📖 *What is this condition?*`,
      `${advice.whatIsIt}`,
      "",
      `❓ *Common Causes:*`,
      `${advice.causes}`,
      progressNote,
      `✅ *Helpful Do's:*`,
      ...advice.dos.map((d) => `• ${d}`),
      "",
      `❌ *Important Don'ts:*`,
      ...advice.donts.map((d) => `• ${d}`),
      "",
      `═══════════════════════`,
      `📄 *Official Clinical PDF Report:*`,
      `Your complete clinical PDF report has been generated. Please share this report with your consulting physician.`,
      `═══════════════════════`,
      `⚠️ *Medical Notice:* This is an AI-assisted screening assessment. Clinical correlation and direct physician consultation are strongly advised.`,
    ].join("\n");
  }

  async function handleSendPdfViaWhatsApp() {
    setError(null);
    setIsProcessing(true);

    let destinationNumber = "";
    if (selectedOption === "patient") {
      if (!hasPatientNumber) {
        setError("Patient record has no mobile number. Please select 'Enter Different Number'.");
        setIsProcessing(false);
        return;
      }
      destinationNumber = patientNumber;
    } else {
      if (!alternateNumber.trim() || !validatePhoneNumber(alternateNumber)) {
        setError("Please enter a valid WhatsApp mobile number with country code.");
        setIsProcessing(false);
        return;
      }
      destinationNumber = alternateNumber.trim();
    }

    const cleanedDestination = cleanNumberForWhatsApp(destinationNumber);
    if (!cleanedDestination || cleanedDestination.length < 8) {
      setError("Unable to format destination phone number. Please include country code (e.g. +91 9876543210).");
      setIsProcessing(false);
      return;
    }

    try {
      // 1. Generate High-Resolution Clinical Vector PDF
      setStatusStep("Generating RespiraAI Clinical PDF Report...");
      const pdfDoc = generateClinicalReportPdf({
        patient,
        prediction,
        report,
        audioFilename: "Auscultation_Recording.wav",
      });

      const fileName = `RespiraAI_Report_${(patient.patient_id || "PAT").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;

      // 2. Download the PDF locally so clinician has it ready for 1-click attachment
      setStatusStep(`Downloading ${fileName}...`);
      pdfDoc.save(fileName);

      // 3. Build WhatsApp multilingual layman message
      const fullMessage = constructMessage(language);
      
      const whatsappUrl = `https://api.whatsapp.com/send/?phone=${cleanedDestination}&text=${encodeURIComponent(fullMessage)}&type=phone_number&app_absent=0`;

      setStatusStep(`Opening chat with +${cleanedDestination}...`);

      setTimeout(() => {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
        setIsProcessing(false);
        setStatusStep(null);
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || "Failed to generate PDF or open WhatsApp.");
      setIsProcessing(false);
      setStatusStep(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-surface p-6 ring-1 ring-black/10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-line pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-sev-low/15 text-sev-low">
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </span>
              <h3 className="font-display text-base font-semibold text-ink">
                Send Report via WhatsApp
              </h3>
            </div>
            <p className="mt-1 text-xs text-mute">
              Directly opens patient chat with easy-to-understand explanations & Do's/Don'ts.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="cursor-pointer rounded-lg p-1 text-mute hover:bg-paper hover:text-ink transition-colors disabled:opacity-50"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Status or Error Notice */}
        {error && (
          <div className="mt-4 rounded-lg bg-sev-high/10 border border-sev-high/30 p-3 text-xs text-sev-high">
            {error}
          </div>
        )}

        {statusStep && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-sev-low/10 border border-sev-low/30 p-3 text-xs text-sev-low font-medium animate-pulse">
            <svg className="size-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
            <span>{statusStep}</span>
          </div>
        )}

        {/* Step 1: Select Language */}
        <div className="mt-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-mute mb-2">
            1. Select Patient Message Language:
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "en", label: "English", sub: "Simple English" },
              { id: "ta", label: "தமிழ்", sub: "Tamil Layman" },
              { id: "hi", label: "हिन्दी", sub: "Hindi Layman" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLanguage(item.id as WhatsAppLanguage)}
                className={`cursor-pointer rounded-xl p-3 text-left border transition-all ${
                  language === item.id
                    ? "border-brand bg-brand-soft/40 ring-1 ring-brand/40 shadow-xs"
                    : "border-line bg-surface hover:bg-paper"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-ink">{item.label}</span>
                  {language === item.id && (
                    <span className="size-2 rounded-full bg-brand" />
                  )}
                </div>
                <p className="text-[10px] text-mute mt-0.5">{item.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Destination Options */}
        <div className="mt-5 space-y-3">
          <label className="block text-xs font-semibold uppercase tracking-wider text-mute">
            2. Recipient WhatsApp Mobile Number:
          </label>

          {/* Option 1: Patient Number */}
          <label
            onClick={() => {
              if (hasPatientNumber && !isProcessing) setSelectedOption("patient");
            }}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all ${
              selectedOption === "patient" && hasPatientNumber
                ? "border-brand bg-brand-soft/30 ring-1 ring-brand/30"
                : !hasPatientNumber
                ? "border-line bg-paper/50 opacity-60 cursor-not-allowed"
                : "border-line bg-surface hover:bg-paper"
            }`}
          >
            <input
              type="radio"
              name="whatsappOption"
              value="patient"
              disabled={!hasPatientNumber || isProcessing}
              checked={selectedOption === "patient" && hasPatientNumber}
              onChange={() => setSelectedOption("patient")}
              className="mt-0.5 text-brand focus:ring-brand"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                Send to Stored Patient Mobile Number
              </p>
              <p className="font-mono text-xs text-mute mt-0.5">
                {hasPatientNumber ? patientNumber : "No mobile number recorded in patient demographics"}
              </p>
            </div>
          </label>

          {/* Option 2: Enter Different Number */}
          <label
            onClick={() => {
              if (!isProcessing) setSelectedOption("different");
            }}
            className={`flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 transition-all ${
              selectedOption === "different"
                ? "border-brand bg-brand-soft/30 ring-1 ring-brand/30"
                : "border-line bg-surface hover:bg-paper"
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="whatsappOption"
                value="different"
                disabled={isProcessing}
                checked={selectedOption === "different" || !hasPatientNumber}
                onChange={() => setSelectedOption("different")}
                className="text-brand focus:ring-brand"
              />
              <span className="text-sm font-medium text-ink">
                Enter Different Mobile Number
              </span>
            </div>

            {(selectedOption === "different" || !hasPatientNumber) && (
              <div className="mt-2 pl-6">
                <input
                  type="tel"
                  disabled={isProcessing}
                  placeholder="e.g. +91 98765 43210 or 9876543210"
                  value={alternateNumber}
                  onChange={(e) => {
                    setAlternateNumber(e.target.value);
                    if (error) setError(null);
                  }}
                  className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-xs font-mono text-ink outline-none transition-all placeholder:text-mute/60 focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                />
                <p className="mt-1 text-[11px] text-mute">
                  Temporary destination only. Will not alter the stored patient profile.
                </p>
              </div>
            )}
          </label>
        </div>

        {/* Message Preview Box */}
        <div className="mt-4 rounded-xl bg-paper p-3 text-xs text-ink/80 ring-1 ring-line">
          <div className="flex items-center justify-between text-[11px] font-semibold text-mute uppercase tracking-wider mb-1">
            <span>Message Content Preview</span>
            <span className="font-mono text-brand font-bold">
              {language === "ta" ? "தமிழ்" : language === "hi" ? "हिन्दी" : "English"}
            </span>
          </div>
          <p className="text-[11px] text-mute">
            Includes: Simplified Condition Explanation • Causes • Practical Do's & Don'ts • PDF Attachment Notice.
          </p>
        </div>

        {/* Modal Actions */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="cursor-pointer rounded-lg border border-line bg-surface px-4 py-2 text-xs font-medium text-ink hover:bg-paper transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendPdfViaWhatsApp}
            disabled={
              isProcessing ||
              (selectedOption === "patient" && !hasPatientNumber) ||
              (selectedOption === "different" && !alternateNumber.trim())
            }
            className="flex cursor-pointer items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-medium text-surface shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <svg className="size-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" />
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                </svg>
                <span>Open WhatsApp Chat with PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
