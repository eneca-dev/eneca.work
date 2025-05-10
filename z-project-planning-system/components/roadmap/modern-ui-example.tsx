"use client"

import { useState } from "react"
import { ChevronDown, Calendar, Filter, Search, BarChart2, BarChart3, Layers, Plus } from "lucide-react"

export default function ModernUIExample() {
  const [activeTab, setActiveTab] = useState("timeline")

  return (
    <div className="bg-gradient-to-br from-slate-50 to-slate-100 min-h-screen p-6 font-sans">
      {/* Header with improved styling */}
      <header className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-teal-500"></div>
              <h1 className="text-lg font-medium text-slate-800">Project Planner</h1>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center">
              <button className="px-4 py-2 text-sm font-medium border-r border-slate-200 text-slate-700 hover:bg-slate-50">
                Website Redesign
              </button>
              <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-50">
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex">
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === "timeline" ? "bg-teal-50 text-teal-600" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setActiveTab("timeline")}
              >
                Timeline
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === "board" ? "bg-teal-50 text-teal-600" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setActiveTab("board")}
              >
                Board
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium ${activeTab === "calendar" ? "bg-teal-50 text-teal-600" : "text-slate-600 hover:bg-slate-50"}`}
                onClick={() => setActiveTab("calendar")}
              >
                Calendar
              </button>
            </div>
          </div>

          <button className="p-2 bg-white rounded-xl shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
            <Calendar size={18} />
          </button>
        </div>
      </header>

      {/* Month navigation with improved styling */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-white p-1.5 rounded-lg shadow-sm border border-slate-200 flex">
            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <Filter size={16} />
            </button>
            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <Layers size={16} />
            </button>
            <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500">
              <Search size={16} />
            </button>
            <div className="h-6 mx-1 w-px bg-slate-200"></div>
            <button className="p-1.5 rounded hover:bg-slate-100 text-blue-500">
              <BarChart2 size={16} />
            </button>
            <button className="p-1.5 rounded hover:bg-slate-100 text-orange-500">
              <BarChart3 size={16} />
            </button>
          </div>

          <div className="text-sm font-medium text-slate-500">Showing 30 days</div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <div className="flex items-center">
              <button className="px-4 py-2 text-sm font-medium text-slate-800">Март 2025</button>
              <div className="h-6 mx-1 w-px bg-slate-200"></div>
              <button className="px-4 py-2 text-sm font-medium text-slate-500">Апрель 2025</button>
            </div>
          </div>

          <div className="flex">
            <button className="p-2 bg-white rounded-l-lg shadow-sm border border-slate-200 text-slate-600 hover:bg-slate-50">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <button className="p-2 bg-white rounded-r-lg shadow-sm border-t border-r border-b border-slate-200 text-slate-600 hover:bg-slate-50">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main content area with improved styling */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Days header */}
        <div className="flex border-b border-slate-200">
          <div className="w-64 min-w-64 p-3 border-r border-slate-200 bg-slate-50"></div>
          <div className="flex-1 flex">
            {Array.from({ length: 15 }).map((_, i) => {
              const isWeekend = i % 7 === 5 || i % 7 === 6
              const isToday = i === 4

              return (
                <div
                  key={i}
                  className={`w-10 h-10 flex items-center justify-center border-r border-slate-200 text-xs font-medium
                    ${isWeekend ? "bg-slate-50" : ""}
                    ${isToday ? "bg-teal-50" : ""}`}
                >
                  <span
                    className={`w-7 h-7 flex items-center justify-center rounded-full
                    ${isToday ? "bg-teal-500 text-white" : "text-slate-600"}`}
                  >
                    {20 + i}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Section row */}
        <div className="group">
          <div className="flex items-center hover:bg-slate-50 transition-colors cursor-pointer">
            <div className="w-64 min-w-64 p-3 font-medium border-r border-slate-200 flex items-center group-hover:bg-slate-50 transition-colors">
              <ChevronDown className="h-5 w-5 mr-2 text-teal-500" />
              <span className="font-semibold text-slate-800">Design Phase</span>
            </div>
            <div className="flex-1 relative h-16 bg-white">
              {/* Chart visualization would go here */}
              <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-xs">
                Chart visualization
              </div>
            </div>
          </div>

          {/* Stage row with modern styling */}
          <div className="flex border-t border-slate-200 hover:bg-slate-50/50 transition-colors">
            <div className="w-64 min-w-64 p-3 pl-12 border-r border-slate-200 flex items-center justify-between">
              <div className="flex items-center flex-grow">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-teal-500 mr-2"
                >
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span className="text-slate-700">Research & Analysis</span>
              </div>
              <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-teal-100 text-teal-500">
                <Plus size={14} />
              </button>
            </div>
            <div className="flex-1 flex relative p-2">
              {/* Modern loading item styling */}
              <div className="absolute top-2 left-8 h-8 rounded-full bg-gradient-to-r from-emerald-100 to-teal-100 border border-emerald-200 flex items-center px-3 shadow-sm">
                <span className="text-xs font-medium text-emerald-800">John Doe (0.5)</span>
              </div>

              <div className="absolute top-2 left-48 h-8 rounded-full bg-gradient-to-r from-blue-100 to-sky-100 border border-blue-200 flex items-center px-3 shadow-sm">
                <span className="text-xs font-medium text-blue-800">Jane Smith (0.75)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating action button with improved styling */}
      <button className="fixed bottom-8 right-8 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white shadow-lg rounded-full h-14 w-14 flex items-center justify-center transition-all hover:scale-105">
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}

