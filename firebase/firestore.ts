
import { getFirestore, doc, getDoc, collection, query, orderBy, getDocs, Firestore } from "firebase/firestore";

interface Project {
  id: string;
  name: string;
  description: string;
  htmlContent: string | null;
  isChunked?: boolean;
  chunkCount?: number;
  [key: string]: any;
}

export const getProjectById = async (db: Firestore, projectId: string): Promise<Project | null> => {
  if (!projectId) return null;

  const projectRef = doc(db, "projects", projectId);
  const projectSnap = await getDoc(projectRef);

  if (!projectSnap.exists()) {
    console.error(`No project found with id: ${projectId}`);
    return null;
  }

  const projectData = projectSnap.data();
  let htmlContent = projectData.htmlContent;

  if (projectData.isChunked) {
    try {
      const chunksCollectionRef = collection(db, "projects", projectId, "htmlChunks");
      const q = query(chunksCollectionRef, orderBy("order"));
      const querySnapshot = await getDocs(q);
      const chunks = querySnapshot.docs.map(doc => doc.data().content);
      htmlContent = chunks.join('');
    } catch (error) {
      console.error("Error fetching chunks:", error);
      // Return the main project data even if chunks fail to load
      htmlContent = '<p>Error loading project content.</p>';
    }
  }

  return {
    id: projectSnap.id,
    ...projectData,
    htmlContent: htmlContent || '',
  } as Project;
};
