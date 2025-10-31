import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { FaBolt, FaUsers, FaBrain, FaGlobe } from "react-icons/fa";
import ThemeToggle from "../components/ThemeToggle"; // 1. Import ThemeToggle

// Header Component
const Header = () => {
  const { theme } = useTheme();

  return (
    // 2. Use grid-cols-3 for centered logo
    <header className="fixed top-0 left-0 right-0 z-50 grid grid-cols-3 items-center p-6 bg-[#fffef0]/80 dark:bg-[#0B0F19]/80 backdrop-blur-md">
      {/* Left section (empty for spacing) */}
      <div className="flex justify-start"></div>

      {/* Center section (Logo) */}
      <div className="flex justify-center">
        <img
          src={
            theme === "dark" ? "/LogoDarkremovebg.png" : "/LogoLightremovebg.png"
          }
          alt="CollabCode"
          className="h-20 w-auto"
          onError={(e) => {
            // fallback to text if image not found
            e.currentTarget.style.display = "none";
            const parent = e.currentTarget.parentElement;
            if (parent && !parent.querySelector(".logo-fallback")) {
              const span = document.createElement("span");
              span.className =
                "logo-fallback text-2xl font-bold text-gray-900 dark:text-white"; // 3. Updated fallback text color
              span.textContent = "CollabCode";
              parent.appendChild(span);
            }
          }}
        />
      </div>

      {/* Right section (Button and Theme Toggle) */}
      <div className="flex items-center justify-end gap-4">
        <ThemeToggle /> {/* 4. Add ThemeToggle */}
        <Link
          to="/join"
          className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-800 transition-colors"
        >
          Get Started
        </Link>
      </div>
    </header>
  );
};

// Hero Section
const Hero = () => (
  <section className="relative flex flex-col items-center justify-center h-screen pt-20 text-center px-6 bg-[#fffef0] dark:bg-[#0B0F19]">
    <div className="relative z-10 flex flex-col items-center">
      <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-[#1A1F2A] rounded-full border border-gray-200 dark:border-[#2A303C]">
        <span className="text-blue-400">✨</span>
        Next-gen collaborative coding
      </div>
      <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6">
        Code Together,
        <br />
        <span className="bg-gradient-to-r from-[#f9943b] to-[#f9943b] bg-clip-text text-transparent">
          Ship Faster
        </span>
      </h1>
      <p className="max-w-xl text-lg text-gray-600 dark:text-gray-400 mb-10">
        The most advanced collaborative code editor. Real-time collaboration,
        AI-powered suggestions, and everything you need to build amazing
        projects together.
      </p>
      <div className="flex gap-4">
        <Link
          to="/join"
          className="px-6 py-3 text-base font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Start Coding Now
        </Link>
      </div>
    </div>
  </section>
);

// Feature Card
const FeatureCard = ({ icon: Icon, title, children }) => (
  // 6. Add dark: variants
  <div className="p-8 bg-gray-50 dark:bg-[#1A1F2A] rounded-lg border border-gray-200 dark:border-[#2A303C]">
    <div className="mb-4 text-2xl text-blue-500 dark:text-blue-400">
      <Icon />
    </div>
    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
      {title}
    </h3>
    <p className="text-gray-600 dark:text-gray-400">{children}</p>
  </div>
);

// Features Section
const Features = () => (
  <section className="py-24 px-6 ">
    <div className="max-w-5xl mx-auto">
      <h2 className="text-4xl font-bold text-gray-900 dark:text-white text-center mb-6">
        Everything you need to collaborate
      </h2>
      <p className="text-lg text-gray-600 dark:text-gray-400 text-center mb-12">
        Built for teams who want to move fast without compromising quality
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <FeatureCard icon={FaUsers} title="Real-time Collaboration">
          Code together with your team in real-time, see changes instantly.
        </FeatureCard>
        <FeatureCard icon={FaBolt} title="Lightning Fast">
          Built for speed with optimized performance and instant updates.
        </FeatureCard>
        <FeatureCard icon={FaBrain} title="AI-Powered">
          Get intelligent code suggestions and autocomplete powered by AI.
        </FeatureCard>
        <FeatureCard icon={FaGlobe} title="Works Everywhere">
          Access your projects from anywhere, no installation required.
        </FeatureCard>
      </div>
    </div>
  </section>
);

// CTA Section
const CTA = () => (
  <section className="py-24 px-6">
    <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-16">
      <h2 className="text-4xl font-bold text-white mb-4">
        Ready to start coding?
      </h2>
      <p className="text-lg text-blue-100 mb-8">
        Join thousands of developers collaborating in real-time.
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

// Footer
const Footer = () => (
  // 9. Add dark: variants
  <footer className="py-12 px-6 text-center">
    <p className="text-gray-500 dark:text-gray-500">
      &copy; {new Date().getFullYear()} CoCode. All rights reserved.
    </p>
  </footer>
);

// Main Page Component
const HomePage = () => {
  return (
    // 10. Add dark: variants
    <div className="bg-[#fffef0] dark:bg-[#0B0F19] min-h-screen text-gray-900 dark:text-white">
      <Header />
      <main>
        <Hero />
        <Features />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default HomePage;
