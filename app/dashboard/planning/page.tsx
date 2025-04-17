export default function PlanningPage() {
  return (
    <main className="w-full h-screen p-0 m-0">
      <div style={{ padding: 16 }}>
        <iframe
          src="https://v0-enecawork.vercel.app/"
          style={{ border: "1px solid #ccc", width: "100%", height: "calc(100vh - 32px)", minHeight: 400, minWidth: 320, borderRadius: 6 }}
          frameBorder={"0"}
          allowFullScreen
          title="Планирование"
        />
      </div>
    </main>
  )
}
