'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getProjectById } from '../../firebase/firestore';
import { useProjectStorage } from '../../hooks/useProjectStorage';
import { getFirestore } from 'firebase/firestore';
import { useFirebase } from '../../firebase/client-provider';

const storageApiScript = `
  (() => {
    const pendingRequests = new Map();
    let requestId = 0;

    window.addEventListener('message', (event) => {
      const { type, requestId: responseId, data, error } = event.data;
      if (type === 'response' && pendingRequests.has(responseId)) {
        const { resolve, reject } = pendingRequests.get(responseId);
        if (error) {
          reject(new Error(error));
        } else {
          resolve(data);
        }
        pendingRequests.delete(responseId);
      }
    });

    function requestFromParent(message) {
      return new Promise((resolve, reject) => {
        const currentId = requestId++;
        pendingRequests.set(currentId, { resolve, reject });
        window.parent.postMessage({ ...message, requestId: currentId }, '*');
      });
    }

    window.getDocFromStorage = (docId) => requestFromParent({ type: 'getDoc', docId });
    window.setDocInStorage = (docId, data) => requestFromParent({ type: 'setDoc', docId, data });
    window.deleteDocFromStorage = (docId) => requestFromParent({ type: 'deleteDoc', docId });
    window.deleteFieldFromDoc = (docId, fieldName) => requestFromParent({ type: 'deleteField', docId, fieldName });
    window.listDocsInStorage = () => requestFromParent({ type: 'listDocs' });

  })();
`;

const fullSandboxPermissions = [
    'allow-downloads', 'allow-forms', 'allow-modals', 'allow-orientation-lock',
    'allow-pointer-lock', 'allow-popups', 'allow-popups-to-escape-sandbox',
    'allow-presentation', 'allow-same-origin', 'allow-scripts',
    'allow-storage-access-by-user-activation', 'allow-top-navigation',
    'allow-top-navigation-by-user-activation', 'allow-top-navigation-to-custom-protocols',
].join(' ');

export default function Project() {
  const { app } = useFirebase();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [project, setProject] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeSrcDoc, setIframeSrcDoc] = useState('');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const storage = useProjectStorage(id ?? '');

  useEffect(() => {
    const getProjectAndSetSrcDoc = async () => {
      if (!id || !app) {
        setIsLoading(false);
        return;
      }
      
      setIsLoading(true);
      try {
        const db = getFirestore(app);
        const projectData = await getProjectById(db, id);
        
        if (projectData) {
          setProject(projectData);
          const fullHtml = `<script>${storageApiScript}</script>${projectData.htmlContent}`;
          setIframeSrcDoc(fullHtml);
        } else {
          setProject(null);
          setIframeSrcDoc('');
        }
      } catch (error) {
        console.error("Error fetching project content:", error);
        setProject(null);
        setIframeSrcDoc('<p>Error loading project.</p>');
      } finally {
        setIsLoading(false);
      }
    };

    getProjectAndSetSrcDoc();
  }, [id, app]);

  useEffect(() => {
    if (!id || !storage.getDocFromStorage) return;

    const handleMessage = async (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      const { type, requestId, docId, data, fieldName } = event.data;
      if (!type) return;

      let response = null;
      let error = null;

      try {
        switch (type) {
          case 'getDoc':
            response = await storage.getDocFromStorage(docId);
            break;
          case 'setDoc':
            await storage.setDocInStorage(docId, data);
            response = { success: true };
            break;
          case 'deleteDoc':
            await storage.deleteDocFromStorage(docId);
            response = { success: true };
            break;
          case 'deleteField':
            await storage.deleteFieldFromDoc(docId, fieldName);
            response = { success: true };
            break;
          case 'listDocs':
            response = await storage.listDocsInStorage();
            break;
          default:
            return;
        }
      } catch (e: any) {
        error = e.message;
      }

      iframeRef.current?.contentWindow.postMessage({ type: 'response', requestId, data: response, error }, '*');
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [id, storage]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!project) {
    return <div>Project not found.</div>;
  }

  return (
    <iframe
      ref={iframeRef}
      className="h-full w-full"
      srcDoc={iframeSrcDoc}
      sandbox={fullSandboxPermissions}
      scrolling="no"
    />
  );
}
