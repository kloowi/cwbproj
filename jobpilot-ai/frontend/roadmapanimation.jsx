// components/Roadmap.jsx
import { useState } from "react";

export default function Roadmap({ stages }) {
  const [current, setCurrent] = useState(1); // stage 0 always starts done

  const complete = (i) => {
    if (i === current) setCurrent(prev => Math.min(prev + 1, stages.length));
  };

  const getStatus = (i) => {
    if (i < current) return "done";
    if (i === current) return "active";
    return "locked";
  };

  return (
    <div>
      {/* progress bar */}
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>Your roadmap</span>
        <span>{current} of {stages.length} completed</span>
      </div>
      <div className="h-1 bg-gray-100 rounded mb-6">
        <div
          className="h-1 bg-green-500 rounded transition-all duration-500"
          style={{ width: `${(current / stages.length) * 100}%` }}
        />
      </div>

      {stages.map((stage, i) => {
        const status = getStatus(i);
        return (
          <div key={i} className="flex gap-3 mb-1">
            {/* circle + connector */}
            <div className="flex flex-col items-center w-8">
              <div className={`w-8 h-8 rounded-full border-2 flex items-center 
                justify-center text-sm font-medium transition-all
                ${status === "done"   ? "bg-green-500 border-green-500 text-white" : ""}
                ${status === "active" ? "border-blue-400 text-blue-600" : ""}
                ${status === "locked" ? "border-gray-200 text-gray-300 bg-gray-50" : ""}
              `}>
                {status === "done" ? "✓" : i + 1}
              </div>
              {i < stages.length - 1 && (
                <div className={`w-0.5 flex-1 my-1 min-h-4 transition-colors
                  ${status === "done" ? "bg-green-400" : "bg-gray-200"}
                `}/>
              )}
            </div>

            {/* card */}
            <div className={`flex-1 pb-5 rounded-xl border p-3 mb-1 transition-all
              ${status === "done"   ? "border-green-200 bg-green-50" : ""}
              ${status === "active" ? "border-blue-200 bg-blue-50"  : ""}
              ${status === "locked" ? "border-gray-100 opacity-50"  : ""}
            `}>
              <p className="font-medium text-sm">{stage.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stage.sub}</p>

              {/* detail — only show if not locked */}
              {status !== "locked" && (
                <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                  {stage.detail}
                </p>
              )}

              {/* complete button — only on active */}
              {status === "active" && (
                <button
                  onClick={() => complete(i)}
                  className="mt-3 text-xs px-3 py-1.5 rounded-lg border 
                             border-green-400 text-green-700 hover:bg-green-50"
                >
                  Mark as complete →
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

The `stages` prop comes straight from your Planner Agent JSON output — no extra transformation needed. Just make sure your agent returns a `detail` field per stage with specific, actionable text and you're set.