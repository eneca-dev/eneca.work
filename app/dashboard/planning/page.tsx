"use client"

export default function PlanningPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", margin: 0, padding: 0, overflow: "hidden" }}>
      <iframe
        src="https://v0-enecawork.vercel.app/"
        style={{ border: "1px solid #ccc", width: "100%", height: "100%", minHeight: 400, minWidth: 320, borderRadius: 6 }}
        frameBorder={"0"}
        allowFullScreen
        title="Планирование"
      />
    </div>
  )
}
