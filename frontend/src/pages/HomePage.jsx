import React from "react";
import { Link } from "react-router-dom";
import { FaBolt, FaUsers, FaBrain, FaGlobe } from "react-icons/fa";

// Header Component
const Header = () => (
  <header className="fixed top-0 left-0 right-0 z-50 flex justify-between items-center p-6 bg-[#0B0F19] bg-opacity-80 backdrop-blur-md">
    <div className="flex items-center gap-2">
      <span className="text-2xl font-bold text-white">CollabCode</span>
    </div>
    <Link
      to="/join"
      className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-800 transition-colors"
    >
      Get Started
    </Link>
  </header>
);

// Hero Section
const Hero = () => (
  <section className="relative flex flex-col items-center justify-center h-screen pt-20 text-center px-6">
    <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0B0F19] z-0"></div>
    <div className="relative z-10 flex flex-col items-center">
      <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-gray-300 bg-[#1A1F2A] rounded-full border border-[#2A303C]">
        <span className="text-blue-400">✨</span>
        Next-gen collaborative coding
      </div>
      <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
        Code Together,
        <br />
        <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Ship Faster
        </span>
      </h1>
      <p className="max-w-xl text-lg text-gray-400 mb-10">
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
        <button className="px-6 py-3 text-base font-medium text-gray-300 bg-[#1A1F2A] border border-[#2A303C] rounded-lg hover:bg-[#2A303C] transition-colors">
          View Demo
        </button>
      </div>
    </div>
  </section>
);

// Feature Card
const FeatureCard = ({ icon: Icon, title, children }) => (
  <div className="p-8 bg-[#1A1F2A] rounded-lg border border-[#2A303C]">
    <div className="mb-4 text-2xl text-blue-400">
      <Icon />
    </div>
    <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
    <p className="text-gray-400">{children}</p>
  </div>
);

// Features Section
const Features = () => (
  <section className="py-24 px-6">
    <div className="max-w-5xl mx-auto">
      <h2 className="text-4xl font-bold text-white text-center mb-6">
        Everything you need to collaborate
      </h2>
      <p className="text-lg text-gray-400 text-center mb-12">
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
        Join thousands of developers collaborating in real-time. No credit card
        required.
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
  <footer className="py-12 px-6 text-center">
    <p className="text-gray-500">
      &copy; {new Date().getFullYear()} CollabCode. All rights reserved.
    </p>
  </footer>
);

// Main Page Component
const HomePage = () => {
  return (
    <div className="bg-[#0B0F19] min-h-screen text-white">
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
