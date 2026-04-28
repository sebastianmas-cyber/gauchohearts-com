'use client';

import { useEffect, useState } from 'react';
import { getFirestore, collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { useFirebase } from '../../firebase/client-provider';
import Link from 'next/link';

interface Project {
  id: string;
  name: string;
  description: string;
  visibility: 'public' | 'unlisted';
  createdAt?: { seconds: number; nanoseconds: number; };
}

export default function AllProjectsPage() {
  const { app } = useFirebase();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      if (!app) return;
      setIsLoading(true);
      const db = getFirestore(app);
      const q = query(
        collection(db, "projects"), 
        where("visibility", "==", "public"), 
        orderBy("createdAt", "desc")
      );
      
      try {
        const querySnapshot = await getDocs(q);
        const projectsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
        setProjects(projectsData);
      } catch (error) {
        console.error("Error fetching projects: ", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, [app]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p className="text-xl text-gray-500">Loading Projects...</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-center mb-4 text-gray-800">All Projects</h1>

          <div className="bg-white rounded-lg shadow-md">
            <ul className="divide-y divide-gray-200">
              {projects.length > 0 ? (
                projects.map(p => (
                  <li key={p.id} className="p-4 hover:bg-gray-50 transition-colors duration-200">
                    <Link href={`/project?id=${p.id}`} className="block">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-lg font-semibold text-blue-600 hover:underline">{p.name || "Untitled Project"}</p>
                          <p className="text-sm text-gray-600 mt-1">{p.description || "No description provided."}</p>
                        </div>
                        <span className="text-sm text-gray-400">
                          {p.createdAt ? new Date(p.createdAt.seconds * 1000).toLocaleDateString() : ''}
                        </span>
                      </div>
                    </Link>
                  </li>
                ))
              ) : (
                <li className="p-6 text-center text-gray-500">
                  No public projects found.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
