// Realistic Mock Dataset for AI Exam Portal

export const INITIAL_EXAMS = [
  {
    id: "exam-1",
    code: "AI2026CS01",
    title: "Advanced Artificial Intelligence & Neural Networks",
    subject: "Computer Science",
    duration: 60, // minutes
    totalQuestions: 15,
    totalMarks: 30,
    passingScore: 18,
    scheduledDate: "2026-08-10",
    scheduledTime: "10:00 AM",
    setter: "Dr. Sharma",
    status: "Active", // Scheduled, Active, Completed
    studentsEnrolled: 42,
    studentsCompleted: 38,
    avgScore: 23.4,
    avgRiskScore: 12.5,
    completionRate: 90.4,
    settings: {
      negativeMarking: true,
      negativeMarkValue: 0.25,
      shuffleQuestions: true,
      shuffleOptions: true,
      enableAIMonitoring: true,
      enableBrowserLock: true,
      enableAudioMonitoring: true,
      enableFullscreenLock: true,
    },
    instructions: [
      "Ensure you are in a quiet, well-lit room with no secondary devices.",
      "Webcam and microphone must remain ON during the entire examination.",
      "Leaving the full-screen mode or switching tabs will automatically trigger a security flag.",
      "AI Proctoring will continuously analyze face visibility, head pose, and object detection (phones, books).",
      "Do not read questions out loud or communicate with anyone in the room.",
    ]
  },
  {
    id: "exam-2",
    code: "AI2026CS02",
    title: "Data Structures & Algorithmic Problem Solving",
    subject: "Computer Science",
    duration: 45,
    totalQuestions: 10,
    totalMarks: 20,
    passingScore: 12,
    scheduledDate: "2026-08-12",
    scheduledTime: "02:30 PM",
    setter: "Prof. Anjali Roy",
    status: "Scheduled",
    studentsEnrolled: 60,
    studentsCompleted: 0,
    avgScore: 0,
    avgRiskScore: 0,
    completionRate: 0,
    settings: {
      negativeMarking: false,
      shuffleQuestions: true,
      shuffleOptions: true,
      enableAIMonitoring: true,
      enableBrowserLock: true,
      enableAudioMonitoring: true,
      enableFullscreenLock: true,
    },
    instructions: [
      "Keep scratch paper visible to the camera at all times.",
      "Calculators are not allowed unless specified in the question.",
      "System check must be completed 10 minutes prior to exam start time."
    ]
  },
  {
    id: "exam-3",
    code: "AI2026CS03",
    title: "Database Management Systems & Distributed SQL",
    subject: "Information Technology",
    duration: 90,
    totalQuestions: 20,
    totalMarks: 40,
    passingScore: 24,
    scheduledDate: "2026-08-05",
    scheduledTime: "11:00 AM",
    setter: "Dr. Sharma",
    status: "Completed",
    studentsEnrolled: 55,
    studentsCompleted: 54,
    avgScore: 31.8,
    avgRiskScore: 8.2,
    completionRate: 98.1,
    settings: {
      negativeMarking: true,
      negativeMarkValue: 0.5,
      shuffleQuestions: true,
      shuffleOptions: true,
      enableAIMonitoring: true,
      enableBrowserLock: true,
      enableAudioMonitoring: true,
      enableFullscreenLock: true,
    },
    instructions: [
      "Answer all questions. Review palette indicator for saved responses."
    ]
  }
];

export const INITIAL_QUESTIONS = [
  {
    id: "q-101",
    type: "MCQ",
    text: "Which activation function is most susceptible to the Vanishing Gradient problem in deep networks?",
    options: ["ReLU", "Sigmoid", "Leaky ReLU", "ELU"],
    correctAnswer: "Sigmoid",
    marks: 2,
    difficulty: "Hard",
    subject: "Computer Science",
    topic: "Neural Networks",
    explanation: "Sigmoid squashes input values into a narrow range between 0 and 1. Derivatives peak at 0.25 and vanish rapidly across deep layers."
  },
  {
    id: "q-102",
    type: "MCQ",
    text: "In Convolutional Neural Networks (CNNs), what primary purpose does Max Pooling serve?",
    options: [
      "Increases spatial resolution of feature maps",
      "Reduces spatial dimensions and controls overfitting",
      "Normalizes gradients across mini-batches",
      "Applies non-linear affine transformations"
    ],
    correctAnswer: "Reduces spatial dimensions and controls overfitting",
    marks: 2,
    difficulty: "Medium",
    subject: "Computer Science",
    topic: "Computer Vision",
    explanation: "Max pooling downsamples spatial size, extracting dominant features while reducing parameters and computational cost."
  },
  {
    id: "q-103",
    type: "True/False",
    text: "Backpropagation computes the gradient of the loss function with respect to each weight using the chain rule.",
    options: ["True", "False"],
    correctAnswer: "True",
    marks: 1,
    difficulty: "Easy",
    subject: "Computer Science",
    topic: "Optimization",
    explanation: "True. Backpropagation applies the multivariate calculus chain rule iteratively from output to input layer."
  },
  {
    id: "q-104",
    type: "Fill in the Blank",
    text: "The architectural component introduced in Transformers to replace recurrent loops is self-______.",
    options: [],
    correctAnswer: "attention",
    marks: 2,
    difficulty: "Medium",
    subject: "Computer Science",
    topic: "Transformers",
    explanation: "Self-attention mechanism enables parallel processing of token representations across sequences."
  },
  {
    id: "q-105",
    type: "MCQ",
    text: "What computer vision framework uses MediaPipe for landmark identification?",
    options: ["YOLOv8", "Google MediaPipe", "OpenCV Cascade", "ResNet-50"],
    correctAnswer: "Google MediaPipe",
    marks: 2,
    difficulty: "Easy",
    subject: "Computer Science",
    topic: "AI Proctoring",
    explanation: "Google MediaPipe provides real-time cross-platform perception pipelines including face mesh and body pose tracking."
  },
  {
    id: "q-106",
    type: "Subjective",
    text: "Explain the key differences between YOLO object detection and traditional sliding window R-CNN architectures.",
    options: [],
    correctAnswer: "YOLO frames detection as a single regression problem from image pixels directly to bounding box coordinates and class probabilities, processing full images in a single forward pass.",
    marks: 5,
    difficulty: "Hard",
    subject: "Computer Science",
    topic: "Object Detection",
    explanation: "Requires manual evaluation or AI grading model."
  }
];

export const INITIAL_STUDENTS = [
  {
    id: "std-1",
    name: "Aarav Sharma",
    prn: "2026CS014",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200",
    riskScore: 2,
    status: "Safe", // Safe, Warning, Critical
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePerson: false,
    headPose: "Center",
    eyeGaze: "Screen Focus",
    lastIncident: "None",
    warningCount: 0,
    cameraActive: true,
    micActive: true,
    ipAddress: "192.168.1.104",
    browser: "Chrome 122 (Windows)",
    videoSeed: 1
  },
  {
    id: "std-2",
    name: "Ananya Patel",
    prn: "2026CS028",
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200",
    riskScore: 48,
    status: "Warning",
    faceVisible: true,
    phoneDetected: false,
    bookDetected: true,
    multiplePerson: false,
    headPose: "Slight Left",
    eyeGaze: "Off Screen",
    lastIncident: "Book detected on desk (02m ago)",
    warningCount: 2,
    cameraActive: true,
    micActive: true,
    ipAddress: "192.168.1.112",
    browser: "Firefox 123 (macOS)",
    videoSeed: 2
  },
  {
    id: "std-3",
    name: "Rohan Verma",
    prn: "2026CS045",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200",
    riskScore: 89,
    status: "Critical",
    faceVisible: false,
    phoneDetected: true,
    bookDetected: false,
    multiplePerson: true,
    headPose: "Down / Turning Away",
    eyeGaze: "Downwards",
    lastIncident: "Mobile Phone & Secondary Person detected (30s ago)",
    warningCount: 4,
    cameraActive: true,
    micActive: true,
    ipAddress: "192.168.1.155",
    browser: "Edge 121 (Windows)",
    videoSeed: 3
  },
  {
    id: "std-4",
    name: "Priya Nair",
    prn: "2026CS089",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=200",
    riskScore: 5,
    status: "Safe",
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePerson: false,
    headPose: "Center",
    eyeGaze: "Screen Focus",
    lastIncident: "None",
    warningCount: 0,
    cameraActive: true,
    micActive: true,
    ipAddress: "192.168.1.180",
    browser: "Chrome 122 (Linux)",
    videoSeed: 4
  },
  {
    id: "std-5",
    name: "Vikram Malhotra",
    prn: "2026CS112",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200",
    riskScore: 35,
    status: "Warning",
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePerson: true,
    headPose: "Right",
    eyeGaze: "Side Glances",
    lastIncident: "Background audio / Voice detected (05m ago)",
    warningCount: 1,
    cameraActive: true,
    micActive: true,
    ipAddress: "192.168.1.202",
    browser: "Safari 17 (macOS)",
    videoSeed: 5
  },
  {
    id: "std-6",
    name: "Sneha Gupta",
    prn: "2026CS140",
    avatar: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=200",
    riskScore: 0,
    status: "Safe",
    faceVisible: true,
    phoneDetected: false,
    bookDetected: false,
    multiplePerson: false,
    headPose: "Center",
    eyeGaze: "Screen Focus",
    lastIncident: "None",
    warningCount: 0,
    cameraActive: true,
    micActive: true,
    ipAddress: "192.168.1.215",
    browser: "Chrome 122 (Windows)",
    videoSeed: 6
  }
];

export const MOCK_INCIDENTS = [
  {
    id: "inc-1",
    timestamp: "10:14:22 AM",
    studentId: "std-3",
    studentName: "Rohan Verma",
    type: "Mobile Phone Detected",
    confidence: "94.2%",
    severity: "Critical",
    details: "YOLOv8 bounding box located smartphone in lower right camera quadrant."
  },
  {
    id: "inc-2",
    timestamp: "10:14:05 AM",
    studentId: "std-3",
    studentName: "Rohan Verma",
    type: "Multiple Persons Detected",
    confidence: "88.7%",
    severity: "Critical",
    details: "MediaPipe landmark tracker identified 2 distinct facial vectors in frame."
  },
  {
    id: "inc-3",
    timestamp: "10:12:40 AM",
    studentId: "std-2",
    studentName: "Ananya Patel",
    type: "Book / Notes Detected",
    confidence: "85.0%",
    severity: "Warning",
    details: "YOLOv8 detected rectangular paper notebook object adjacent to keyboard."
  },
  {
    id: "inc-4",
    timestamp: "10:08:15 AM",
    studentId: "std-5",
    studentName: "Vikram Malhotra",
    type: "Head Turning / Looking Away",
    confidence: "91.4%",
    severity: "Warning",
    details: "MediaPipe yaw angle pitch > 35° sustained for more than 4.5 seconds."
  },
  {
    id: "inc-5",
    timestamp: "10:05:00 AM",
    studentId: "std-3",
    studentName: "Rohan Verma",
    type: "Fullscreen Exit",
    confidence: "100%",
    severity: "Warning",
    details: "Browser window blur event / tab switch logged."
  }
];

export const MOCK_REPORTS = [
  {
    id: "rep-1",
    examCode: "AI2026CS01",
    examTitle: "Advanced Artificial Intelligence & Neural Networks",
    date: "2026-08-08",
    totalStudents: 42,
    avgScore: "23.4 / 30",
    avgRiskScore: "12.5%",
    flaggedStudents: 3,
    completionRate: "90.4%",
    status: "Completed"
  },
  {
    id: "rep-2",
    examCode: "AI2026CS03",
    examTitle: "Database Management Systems & Distributed SQL",
    date: "2026-08-05",
    totalStudents: 55,
    avgScore: "31.8 / 40",
    avgRiskScore: "8.2%",
    flaggedStudents: 1,
    completionRate: "98.1%",
    status: "Completed"
  },
  {
    id: "rep-3",
    examCode: "AI2026CS00",
    examTitle: "Operating System Kernels & Concurrency",
    date: "2026-07-28",
    totalStudents: 38,
    avgScore: "18.2 / 25",
    avgRiskScore: "15.0%",
    flaggedStudents: 4,
    completionRate: "89.5%",
    status: "Completed"
  }
];

export const MOCK_RISK_TIMELINE = [
  { time: "10:00", risk: 2 },
  { time: "10:05", risk: 5 },
  { time: "10:10", risk: 12 },
  { time: "10:15", risk: 45 },
  { time: "10:20", risk: 89 },
  { time: "10:25", risk: 85 },
  { time: "10:30", risk: 89 },
  { time: "10:35", risk: 78 }
];
