import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import ThemeToggle from "../components/ThemeToggle";
import {
  FaBolt,
  FaUsers,
  FaBrain,
  FaGlobe,
  FaPlay,
  FaUser,
  FaJava,
  FaBroadcastTower,
} from "react-icons/fa";
import {
  SiPython,
  SiJavascript,
  SiHtml5,
  SiCss3,
  SiReact,
  SiCplusplus,
  SiTypescript,
  SiC,
  SiRuby,
  SiSwift,
  SiPhp,
  SiDart,
  SiGo,
} from "react-icons/si";

// --- Header Component (Unchanged from your file) ---
const Header = () => {
  const { theme } = useTheme();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 grid grid-cols-3 items-center p-6 bg-[#fffef0]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md">
      <div className="flex justify-start"></div>
      <div className="flex justify-center">
        <img
          src={
            theme === "dark" ? "/LogoDarkremovebg.png" : "/LogoLightremovebg.png"
          }
          alt="CollabCode"
          className="h-20 w-auto"
          onError={(e) => {
            e.currentTarget.style.display = "none";
            const parent = e.currentTarget.parentElement;
            if (parent && !parent.querySelector(".logo-fallback")) {
              const span = document.createElement("span");
              span.className =
                "logo-fallback text-2xl font-bold text-gray-900 dark:text-white";
              span.textContent = "CollabCode";
              parent.appendChild(span);
            }
          }}
        />
      </div>
      <div className="flex items-center justify-end gap-4">
        <ThemeToggle />
        <Link
          to="/join"
          className="px-5 py-2.5 text-sm font-medium text-white bg-[#ffb06b] rounded-lg hover:bg-[#f9943b] focus:outline-none focus:ring-4 focus:ring-orange-300 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </header>
  );
};

// --- NEW: Animated Code Snippet for Hero ---
// --- FIXED: Animated Code Snippet for Hero ---
const AnimatedHeroEditor = () => {
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState("");
  const [animationComplete, setAnimationComplete] = useState(false);
  const { theme } = useTheme();

  const codeLine1 = 'def get_user_data(user_id):';
  const codeLine2 = '    # Fetch user from database...';
  const aiSugg = "\n    user = db.users.get(id=user_id)\n    return user.to_json()";

  useEffect(() => {
    // Clear any existing content and reset state
    setLine1("");
    setLine2("");
    setAiSuggestion("");
    setAnimationComplete(false);

    let timeoutIds = [];

    // Animate line 1
    codeLine1.split("").forEach((char, index) => {
      const timeoutId = setTimeout(() => setLine1((prev) => prev + char), 500 + index * 50);
      timeoutIds.push(timeoutId);
    });

    // Animate line 2
    codeLine2.split("").forEach((char, index) => {
      const timeoutId = setTimeout(
        () => setLine2((prev) => prev + char),
        500 + codeLine1.length * 50 + index * 50
      );
      timeoutIds.push(timeoutId);
    });

    // Animate AI suggestion
    aiSugg.split("").forEach((char, index) => {
      const timeoutId = setTimeout(
        () => setAiSuggestion((prev) => prev + char),
        1000 + (codeLine1.length + codeLine2.length) * 50 + index * 30
      );
      timeoutIds.push(timeoutId);
    });

    // Mark animation as complete
    const completeTimeout = setTimeout(() => {
      setAnimationComplete(true);
    }, 1000 + (codeLine1.length + codeLine2.length) * 50 + aiSugg.length * 30 + 500);

    timeoutIds.push(completeTimeout);

    // Cleanup function to prevent infinite loops
    return () => {
      timeoutIds.forEach((id) => clearTimeout(id));
    };
  }, []); // Empty dependency array means this runs only once on mount

  return (
    <div
      className={`relative w-full max-w-2xl mx-auto mt-12 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 ${
        theme === "light" ? "bg-white" : "bg-[#1e1e1e]"
      }`}
    >
      {/* Fake window bar */}
      <div className="flex items-center h-8 px-3 space-x-1.5 bg-gray-100 dark:bg-[#323233] rounded-t-lg">
        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
      </div>

      {/* Fake user avatars - BOTH with glowing effect */}
      <div className="absolute top-10 right-4 flex flex-col space-y-2">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500 text-white text-xs font-medium ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-800 animate-pulse">
          A
        </div>
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-pink-500 text-white text-xs font-medium ring-2 ring-pink-500 ring-offset-2 dark:ring-offset-gray-800 animate-pulse">
          B
        </div>
      </div>

      {/* Code Area */}
      <pre className="p-4 text-left text-sm font-mono overflow-auto">
        {/* User A's cursor - ALWAYS visible and glowing */}
        <span className="relative">
          <code className="text-[#000080] dark:text-[#569cd6]">{line1}</code>
          <span className="absolute right-0 -mr-1 h-5 w-0.5 bg-blue-500 animate-pulse"></span>
        </span>
        <br />
        {/* User B's cursor - ALWAYS visible and glowing */}
        <span className="relative">
          <code className="text-gray-400 dark:text-gray-500">{line2}</code>
          <span className="absolute right-0 -mr-1 h-5 w-0.5 bg-pink-500 animate-pulse"></span>
        </span>
        {/* AI Suggestion */}
        <code className="text-gray-600 dark:text-gray-400 opacity-70">
          {aiSuggestion}
        </code>
      </pre>
    </div>
  );
};

// --- Updated Hero Section ---
const Hero = () => (
  <section className="relative flex flex-col items-center justify-center h-screen pt-20 text-center px-6 bg-[#fffef0] dark:bg-[#0B0F19]">
    <div className="relative z-10 flex flex-col items-center">
      {/* <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#1A1F2A] rounded-full border border-gray-200 dark:border-[#2A303C]">
        <span className="text-[#f9943b]">✨</span>
        AI-Powered with Voice Chat
      </div> */}
      <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6">
        Code Together,
        <br />
        <span className="bg-gradient-to-r from-[#f9943b] to-[#ffb06b] bg-clip-text text-transparent">
          Ship Faster
        </span>
      </h1>
      <p className="max-w-xl text-lg text-gray-600 dark:text-gray-400 mb-10">
        The real-time editor that pairs you with AI and your team.
        Run code, talk with voice chat, and get live previews, all in one place.
      </p>
      <div className="flex gap-4">
        <Link
          to="/join"
          className="px-6 py-3 text-base font-medium text-white bg-[#ffb06b] rounded-lg hover:bg-[#f9943b] transition-colors"
        >
          Start Coding Now
        </Link>
      </div>
      
      {/* Add the animated hero component */}
      <AnimatedHeroEditor />
    </div>
  </section>
);

// --- NEW: Replaces the simple card list ---
const FeatureShowcase = () => (
  <section className="py-24 px-6 bg-[#fffef0] dark:bg-[#11141D]">
    <div className="max-w-5xl mx-auto">
      <h2 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-16">
        Everything you need. Nothing you don't.
      </h2>

      {/* Feature 1: AI */}
      <FeatureRow
        icon={FaBrain}
        title="Your AI Pair Programmer"
        description="Stop coding alone. Get intelligent suggestions from Codestral, find bugs faster, and let AI help you tackle complex problems, right in your editor."
        graphic={
          <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <pre className="font-mono text-sm">
              <code className="text-gray-500">def calculate_fib(n):</code>
              <br />
              <code className="text-gray-500">  <span className="text-blue-600 dark:text-blue-400">if</span> n &lt;= 1:</code>
              <br />
              <code className="text-gray-500">    <span className="text-blue-600 dark:text-blue-400">return</span> n</code>
              <br />
              <code className="text-green-600 dark:text-green-400 bg-green-500/10">  # AI Suggestion:</code>
              <br />
              <code className="text-green-600 dark:text-green-400 bg-green-500/10">  return calculate_fib(n-1) + calculate_fib(n-2)</code>
            </pre>
          </div>
        }
      />

      {/* Feature 2: Live Preview */}
      <FeatureRow
        icon={FaBroadcastTower}
        title="Real-time Live Preview"
        description="Build websites together, instantly. Edit your HTML, CSS, and JavaScript and see your changes render in real-time in a shared browser preview. No more refreshing."
        graphic={
          <div className="grid grid-cols-2 gap-2 p-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <pre className="font-mono text-xs p-2 bg-white dark:bg-gray-900 rounded">
              <code className="text-blue-600 dark:text-blue-400">&lt;h1&gt;</code>
              <code>Hello!</code>
              <code className="text-blue-600 dark:text-blue-400">&lt;/h1&gt;</code>
              <br />
              <code className="text-blue-600 dark:text-blue-400">&lt;style&gt;</code>
              <br />
              <code>  h1 {'{'} <span className="text-red-500">color: #f9943b;</span> {'}'}</code>
              <br />
              <code className="text-blue-600 dark:text-blue-400">&lt;/style&gt;</code>
            </pre>
            <div className="flex items-center justify-center bg-white dark:bg-gray-900 rounded p-4">
              <h1 className="text-3xl font-bold" style={{ color: "#f9943b" }}>
                Hello!
              </h1>
            </div>
          </div>
        }
        reverse={true}
      />

      {/* Feature 3: Voice + Docker */}
      <FeatureRow
        icon={FaUsers}
        title="Integrated Voice & Secure Runtimes"
        description="Ditch Discord. Talk directly to your team with integrated voice chat. When you're ready, run your code securely in isolated Docker containers."
        graphic={
          <div className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-3">Supported Languages</h4>
            <div className="grid grid-cols-4 gap-4 text-center">
              <SiPython size={32} className="mx-auto text-blue-500" title="Python" />
              <FaJava size={32} className="mx-auto text-red-500" title="Java" />
              <SiCplusplus size={32} className="mx-auto text-blue-600" title="C++" />
              <SiJavascript size={32} className="mx-auto text-yellow-500" title="JavaScript" />
              <SiHtml5 size={32} className="mx-auto text-orange-500" title="HTML5" />
              <SiCss3 size={32} className="mx-auto text-blue-400" title="CSS3" />
              <SiRuby size={32} className="mx-auto text-red-400" title="Ruby" />
              <SiTypescript size={32} className="mx-auto text-blue-500" title="TypeScript" />

              <SiSwift size={32} className="mx-auto text-orange-400" title="Swift" />
              <SiPhp size={32} className="mx-auto text-purple-600" title="PHP" />
              <SiDart size={32} className="mx-auto text-blue-300" title="Dart" />
              <SiGo size={32} className="mx-auto text-teal-400" title="Go" />
              
            </div>
          </div>
        }
      />
    </div>
  </section>
);

// Helper component for the feature section
const FeatureRow = ({ icon: Icon, title, description, graphic, reverse = false }) => (
  <div className={`flex flex-col md:flex-row items-center gap-12 mb-20 ${reverse ? "md:flex-row-reverse" : ""}`}>
    <div className="w-full md:w-1/2">
      <div className="mb-4 inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#f9943b]/10 text-[#f9943b]">
        <Icon size={24} />
      </div>
      <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{title}</h3>
      <p className="text-lg text-gray-600 dark:text-gray-400">{description}</p>
    </div>
    <div className="w-full md:w-1/2">
      {graphic}
    </div>
  </div>
);


// --- CTA Section (Re-styled buttons) ---
const CTA = () => (
  <section className="py-24 px-6 bg-[#fffef0] dark:bg-[#0B0F19]">
    <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-[#f9943b] to-[#ffb06b] rounded-lg p-16">
      <h2 className="text-4xl font-bold text-white mb-4">
        Ready to start coding?
      </h2>
      <p className="text-lg text-white/80 mb-8">
        Join or create a room in seconds.
      </p>
      <Link
        to="/join"
        className="px-8 py-3.5 text-base font-medium text-gray-900 bg-white rounded-lg hover:bg-gray-200 transition-colors"
      >
        Create Your First Room
      </Link>
    </div>
  </section>
);

// --- Footer (Unchanged from your file) ---
const Footer = () => (
  <footer className="py-12 px-6 text-center bg-[#fffef0] dark:bg-[#0B0F19]">
    <p className="text-gray-500 dark:text-gray-500">
      &copy; {new Date().getFullYear()} CoCode. All rights reserved.
    </p>
  </footer>
);

// --- Main Page Component ---
const HomePage = () => {
  return (
    <div className="bg-[#fffef0] dark:bg-[#0B0F19] min-h-screen text-gray-900 dark:text-white">
      <Header />
      <main>
        <Hero />
        <FeatureShowcase />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;