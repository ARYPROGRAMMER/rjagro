"use client";
import React from "react";
import { motion } from "framer-motion";

import { User } from "../types/auth";
import TextType from "./TextType";

interface GreeterProps {
  user: User | null;
}

const Greeter: React.FC<GreeterProps> = ({ user }) => {
  const greeting = user ? `Hello, ${user.name}!` : "Hello, Guest!";

  return (
    <motion.div
      className="mb-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: "easeOut" }}
    >
      <div className="relative" role="banner" aria-label="Welcome message">
        {/* Animated background gradient */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 rounded-xl blur-xl transform scale-110"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.2 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />

        {/* Main greeting card */}
        <motion.div
          className="relative bg-white rounded-xl shadow-xl border border-gray-100 p-8 overflow-hidden"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          whileHover={{
            scale: 1.02,
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            transition: { duration: 0.3 },
          }}
        >
          {/* Floating background elements */}
          <motion.div
            className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-100 to-blue-100 rounded-full transform translate-x-16 -translate-y-16 opacity-50"
            animate={{
              y: [-10, 10, -10],
              rotate: [-5, 5, -5],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <motion.div
            className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-100 to-pink-100 rounded-full transform -translate-x-12 translate-y-12 opacity-50"
            animate={{
              y: [-10, 10, -10],
              rotate: [-5, 5, -5],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
          />

          <div className="relative z-10">
            <div className="flex items-center space-x-4">
              {/* Animated Avatar */}
              <motion.div
                className="w-16 h-16 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                  delay: 0.3,
                }}
                whileHover={{
                  scale: 1.1,
                  rotate: 5,
                  transition: { duration: 0.2 },
                }}
                whileTap={{ scale: 0.95 }}
              >
                {user?.name && user.name.trim()
                  ? user.name.trim().charAt(0).toUpperCase()
                  : "G"}
              </motion.div>

              {/* Greeting text with typing animation */}
              <motion.div
                className="flex-1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                <h2 className="text-3xl font-bold text-gray-800 mb-2 leading-tight">
                  <TextType
                    text={greeting}
                    typingSpeed={80}
                    showCursor={true}
                    cursorCharacter="|"
                    cursorClassName="text-green-500"
                    className="inline"
                  />
                </h2>
                <motion.p
                  className="text-gray-600 text-lg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.5 }}
                >
                  Welcome back to your dashboard. Let&apos;s make today
                  productive!
                </motion.p>
              </motion.div>
            </div>

            {/* Animated dots and date */}
            <motion.div
              className="mt-6 flex items-center space-x-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.8, duration: 0.5 }}
            >
              <div className="flex space-x-1">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-gradient-to-r from-green-400 to-blue-500 rounded-full"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      delay: 1.2 + i * 0.1,
                      type: "spring",
                      stiffness: 300,
                      damping: 20,
                    }}
                    whileHover={{
                      scale: 1.5,
                      backgroundColor: "#10b981",
                      transition: { duration: 0.2 },
                    }}
                  />
                ))}
              </div>
              <motion.span
                className="text-sm text-gray-500 font-medium"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 2.2, duration: 0.5 }}
              >
                {new Date().toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </motion.span>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Greeter;
