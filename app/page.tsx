'use client';
import Link from 'next/link';
import { useFirebase } from '@/firebase/client-provider';

export default function Home() {
  const { user } = useFirebase();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">
          <span className="text-blue-500 text-5xl">Sebastian</span>.gauchohearts.com
        </h1>
        <p className="text-lg mb-8">View projects from direct links</p>
        <Link href="/all">
          <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
            View All Projects
          </button>
        </Link>
      </div>
    </main>
  );
}
