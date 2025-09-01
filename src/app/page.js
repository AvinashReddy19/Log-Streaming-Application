// src/app/page.js
import LogStreamViewer from "@/components/LogStreamViewer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <header className="py-4 border-b border-gray-800">
        <div className="container mx-auto px-4">
          <h1 className="text-xl font-bold">Docker Log Streaming</h1>
        </div>
      </header>
      <main>
        <LogStreamViewer />
      </main>
      <footer className="py-4 border-t border-gray-800 mt-8">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          &copy; {new Date().getFullYear()} Docker Log Stream Viewer
        </div>
      </footer>
    </div>
  );
}