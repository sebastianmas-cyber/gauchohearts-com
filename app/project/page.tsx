'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { getFirestore, doc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore"; 
import { useFirebase } from '../../firebase/client-provider';

interface ProjectData {
  name: string;
  description: string;
  htmlContent: string | null;
  isChunked?: boolean;
  chunkCount?: number;
  sandbox?: string;
  allow?: string;
  legacy?: string[];
  owner?: string;
  visibility?: 'public' | 'unlisted';
}

export default function ProjectPage() {
  const { app } = useFirebase();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjectData = useCallback(async () => {
    if (!projectId || !app) {
        setIsLoading(false);
        setError('Project ID is missing or Firebase app is not available.');
        return;
    }
    setIsLoading(true);
    const db = getFirestore(app);
    const projectRef = doc(db, 'projects', projectId);

    try {
      const docSnap = await getDoc(projectRef);
      if (docSnap.exists()) {
        const data = docSnap.data() as ProjectData;
        if (data.isChunked) {
          const chunksCollectionRef = collection(db, "projects", projectId, "htmlChunks");
          const q = query(chunksCollectionRef, orderBy("order"));
          const querySnapshot = await getDocs(q);
          const chunks = querySnapshot.docs.map(doc => doc.data().content);
          data.htmlContent = chunks.join('');
        }
        setProjectData(data);
      } else {
        setError("No such project!");
      }
    } catch (e) {
      console.error("Error getting document:", e);
      setError("Failed to load project.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId, app]);

  useEffect(() => {
    fetchProjectData();
  }, [fetchProjectData]);

  useEffect(() => {
    if (projectData) {
      if (projectData.htmlContent) {
        const titleMatch = projectData.htmlContent.match(/<title>(.*?)<\/title>/i);
        document.title = titleMatch ? titleMatch[1] : projectData.name;
      } else {
        document.title = projectData.name;
      }
    }
  }, [projectData]);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen">Loading project...</div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen">Error: {error}</div>;
  }

  if (!projectData) {
    return <div className="flex justify-center items-center h-screen">Project not found.</div>;
  }

  const legacyProps = projectData.legacy?.reduce((acc, p) => {
    if (p === 'allowfullscreen') {
      acc['allowFullScreen'] = true;
    } else {
      acc[p] = 'true';
    }
    return acc;
  }, {} as {[key: string]: any}) || {};

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden">
      <iframe
        className="w-full h-full border-none"
        srcDoc={projectData.htmlContent || ''}
        sandbox={projectData.sandbox || ''}
        allow={projectData.allow || ''}
        {...legacyProps}
        title={projectData.name}
      />
    </div>
  );
}
