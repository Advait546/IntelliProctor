// Realistic mock JSON data for Smart Examination Portal

export const INITIAL_EXAMS = [
  {
    id: "AI2026CS01",
    title: "Computer Science & AI Fundamentals 2026",
    subject: "Artificial Intelligence",
    duration: 60, // in minutes
    totalQuestions: 15,
    scheduledDate: "2026-08-04",
    scheduledTime: "10:00 AM",
    status: "Active",
    code: "AI2026CS01",
    registeredStudents: 48,
    activeStudents: 42,
    avgScore: 84.5,
    avgRiskScore: 12.4,
    completionRate: 78,
    instructions: "Strict AI proctoring enabled. Ensure your camera and microphone stay connected at all times. Do not look away or leave the browser window.",
    settings: {
      aiMonitoring: true,
      browserLock: true,
      audioMonitoring: true,
      fullscreenLock: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      negativeMarking: 0.25,
    }
  },
  {
    id: "DS2026M02",
    title: "Data Structures & Algorithms Advanced Midterm",
    subject: "Computer Science",
    duration: 90,
    totalQuestions: 20,
    scheduledDate: "2026-08-05",
    scheduledTime: "02:00 PM",
    status: "Scheduled",
    code: "DS2026M02",
    registeredStudents: 120,
    activeStudents: 0,
    avgScore: 0,
    avgRiskScore: 0,
    completionRate: 0,
    instructions: "Standard rules apply. Negative marking of 0.5 points per wrong answer.",
    settings: {
      aiMonitoring: true,
      browserLock: true,
      audioMonitoring: true,
      fullscreenLock: true,
      shuffleQuestions: false,
      shuffleOptions: true,
      negativeMarking: 0.5,
    }
  },
  {
    id: "ML2026A03",
    title: "Machine Learning & Neural Networks Final",
    subject: "Data Science",
    duration: 120,
    totalQuestions: 25,
    scheduledDate: "2026-08-02",
    scheduledTime: "11:00 AM",
    status: "Completed",
    code: "ML2026A03",
    registeredStudents: 95,
    activeStudents: 0,
    avgScore: 89.2,
    avgRiskScore: 8.7,
    completionRate: 98,
    instructions: "Completed final examination for Spring session.",
    settings: {
      aiMonitoring: true,
      browserLock: true,
      audioMonitoring: true,
      fullscreenLock: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      negativeMarking: 0.0,
    }
  }
];

export const MOCK_QUESTIONS = [
  {
    id: "q1",
    type: "MCQ",
    text: "Which neural network architecture is primarily designed for sequential time-series data and natural language processing?",
    optionA: "Convolutional Neural Network (CNN)",
    optionB: "Recurrent Neural Network (RNN / LSTM)",
    optionC: "Generative Adversarial Network (GAN)",
    optionD: "Multilayer Perceptron (MLP)",
    correctAnswer: "B",
    marks: 2,
    difficulty: "Medium",
    topic: "Neural Networks"
  },
  {
    id: "q2",
    type: "MCQ",
    text: "What is the primary loss function used in binary classification models?",
    optionA: "Mean Squared Error (MSE)",
    optionB: "Binary Cross-Entropy Loss",
    optionC: "Categorical Cross-Entropy Loss",
    optionD: "Hinge Loss",
    correctAnswer: "B",
    marks: 2,
    difficulty: "Easy",
    topic: "Machine Learning"
  },
  {
    id: "q3",
    type: "TrueFalse",
    text: "MediaPipe utilizes lightweight Deep Learning models for real-time face mesh landmark detection directly in browser environments.",
    optionA: "True",
    optionB: "False",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
    marks: 1,
    difficulty: "Easy",
    topic: "Computer Vision"
  },
  {
    id: "q4",
    type: "FillBlank",
    text: "In YOLO object detection, YOLO stands for You Only _____ Once.",
    optionA: "Look",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "Look",
    marks: 2,
    difficulty: "Easy",
    topic: "Computer Vision"
  },
  {
    id: "q5",
    type: "MCQ",
    text: "What problem does the Attention mechanism solve in Transformer models?",
    optionA: "Vanishing gradient problem in long sequence dependencies",
    optionB: "High memory consumption during image preprocessing",
    optionC: "Overfitting on small tabular datasets",
    optionD: "Slow single-threaded CPU calculation speed",
    correctAnswer: "A",
    marks: 3,
    difficulty: "Hard",
    topic: "Deep Learning"
  },
  {
    id: "q6",
    type: "Subjective",
    text: "Explain the difference between L1 and L2 regularization methods in Machine Learning models.",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "L1 (Lasso) adds absolute values of coefficients producing sparse weights, while L2 (Ridge) adds squared magnitudes preventing extreme weights.",
    marks: 5,
    difficulty: "Hard",
    topic: "Model Optimization"
  }
];

export const MOCK_STUDENTS_LIVE = [
  {
    id: "std-101",
    rollNumber: "2026-CS-042",
    name: "Aarav Sharma",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250",
    riskScore: 8,
    status: "Safe", // Safe | Warning | Critical
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePersons: false,
    gazeDirection: "Center",
    warningCount: 0,
    headPose: { pitch: 2, yaw: -1, roll: 0 },
    lastIncident: "None",
    currentQuestion: 5
  },
  {
    id: "std-102",
    rollNumber: "2026-CS-089",
    name: "Rohan Verma",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250",
    riskScore: 78,
    status: "Critical",
    faceVisible: true,
    phoneDetected: true,
    bookDetected: false,
    multiplePersons: true,
    gazeDirection: "Left",
    warningCount: 4,
    headPose: { pitch: -18, yaw: 35, roll: 5 },
    lastIncident: "Secondary person & Smartphone detected near desk at 10:14 AM",
    currentQuestion: 8
  },
  {
    id: "std-103",
    rollNumber: "2026-CS-114",
    name: "Ananya Iyer",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250",
    riskScore: 42,
    status: "Warning",
    faceVisible: true,
    phoneDetected: false,
    bookDetected: true,
    multiplePersons: false,
    gazeDirection: "Down",
    warningCount: 2,
    headPose: { pitch: -25, yaw: 4, roll: -2 },
    lastIncident: "Textbook detected on lap area at 10:22 AM",
    currentQuestion: 11
  },
  {
    id: "std-104",
    rollNumber: "2026-CS-023",
    name: "Priya Patel",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250",
    riskScore: 5,
    status: "Safe",
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePersons: false,
    gazeDirection: "Center",
    warningCount: 0,
    headPose: { pitch: 0, yaw: 2, roll: 1 },
    lastIncident: "None",
    currentQuestion: 12
  },
  {
    id: "std-105",
    rollNumber: "2026-CS-156",
    name: "Vikram Malhotra",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250",
    riskScore: 88,
    status: "Critical",
    faceVisible: false,
    phoneDetected: false,
    bookDetected: false,
    multiplePersons: false,
    gazeDirection: "Away",
    warningCount: 5,
    headPose: { pitch: -45, yaw: -60, roll: -12 },
    lastIncident: "Face missing from camera frame for > 45 seconds at 10:28 AM",
    currentQuestion: 4
  },
  {
    id: "std-106",
    rollNumber: "2026-CS-071",
    name: "Sneha Reddi",
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250",
    riskScore: 12,
    status: "Safe",
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePersons: false,
    gazeDirection: "Center",
    warningCount: 0,
    headPose: { pitch: 1, yaw: -3, roll: 0 },
    lastIncident: "None",
    currentQuestion: 14
  }
];

export const MOCK_INCIDENT_TIMELINE = [
  { time: "10:02:15 AM", event: "Exam Session Started", severity: "info", detail: "Face mesh & browser lock initialized" },
  { time: "10:08:40 AM", event: "Browser Tab Focus Lost", severity: "warning", detail: "Window blurred for 3.2 seconds" },
  { time: "10:14:12 AM", event: "YOLO: Phone Detected", severity: "critical", detail: "Smartphone object detected with 94.2% confidence score" },
  { time: "10:14:18 AM", event: "YOLO: Multiple Person", severity: "critical", detail: "Second face identified behind candidate" },
  { time: "10:20:05 AM", event: "Head Pose Deviation", severity: "warning", detail: "Candidate looking left continuously (>12 sec)" },
  { time: "10:25:30 AM", event: "Audio Noise Spike", severity: "warning", detail: "Whispering background voice detected (-18dB)" }
];

export const MOCK_RISK_GRAPH_DATA = [
  { time: "10:00", riskScore: 0, headYaw: 2, gazeDev: 1 },
  { time: "10:05", riskScore: 5, headYaw: 5, gazeDev: 3 },
  { time: "10:10", riskScore: 15, headYaw: 12, gazeDev: 10 },
  { time: "10:14", riskScore: 82, headYaw: 35, gazeDev: 40 },
  { time: "10:18", riskScore: 78, headYaw: 28, gazeDev: 25 },
  { time: "10:22", riskScore: 65, headYaw: 15, gazeDev: 12 },
  { time: "10:28", riskScore: 88, headYaw: 60, gazeDev: 55 }
];

export const MOCK_REPORTS = [
  {
    id: "rep-01",
    examName: "Computer Science & AI Fundamentals 2026",
    code: "AI2026CS01",
    date: "2026-08-03",
    students: 48,
    avgScore: "84.5%",
    avgRiskScore: "12.4%",
    completionRate: "95.8%",
    incidentsFlagged: 4,
    status: "Completed"
  },
  {
    id: "rep-02",
    examName: "Machine Learning & Neural Networks Final",
    code: "ML2026A03",
    date: "2026-08-02",
    students: 95,
    avgScore: "89.2%",
    avgRiskScore: "8.7%",
    completionRate: "98.0%",
    incidentsFlagged: 2,
    status: "Completed"
  },
  {
    id: "rep-03",
    examName: "Database Systems & SQL Optimization",
    code: "DB2026Q04",
    date: "2026-07-28",
    students: 62,
    avgScore: "76.1%",
    avgRiskScore: "19.8%",
    completionRate: "91.5%",
    incidentsFlagged: 9,
    status: "Completed"
  }
];

export const DEFAULT_SETTINGS = {
  aiSettings: {
    yoloConfidenceThreshold: 75, // %
    headPoseAngleLimit: 25, // degrees
    gazeOutBoundsTimeLimit: 5, // seconds
    audioNoiseThreshold: 65, // dB
    autoFlagHighRisk: true,
  },
  notificationSettings: {
    emailAlertsOnCritical: true,
    soundAlertsOnWarning: true,
    autoTerminateCriticalStudents: false,
  },
  examRules: {
    allowScratchpad: true,
    allowCalculator: false,
    requireFullscreen: true,
    enforceSingleTab: true,
  },
  account: {
    name: "Dr. Sharma",
    email: "dr.sharma@university.edu",
    role: "Senior Exam Coordinator",
    department: "Department of AI & Computer Science"
  }
};
