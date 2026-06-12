import Link from "next/link";

export default function CreateArchivePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 text-white">
      <h1 className="text-5xl font-bold mb-8">
        🌌 Create Archive
      </h1>

      <div className="bg-gray-900 p-8 rounded-2xl w-96 space-y-4">
        <input
          type="text"
          placeholder="Archive Username"
          className="w-full p-3 rounded-lg bg-gray-800 outline-none"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-3 rounded-lg bg-gray-800 outline-none"
        />

        <Link
          href="/dashboard"
          className="block text-center bg-blue-600 py-3 rounded-lg hover:bg-blue-500 transition"
        >
          Create Archive
        </Link>

        <Link
          href="/login"
          className="block text-center bg-gray-700 py-3 rounded-lg hover:bg-gray-600 transition"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}