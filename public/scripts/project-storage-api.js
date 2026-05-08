
// public/scripts/project-storage-api.js

/**
 * This script provides a simple API for an iframe to communicate with the parent window
 * and interact with the project's Firestore storage. It uses window.postMessage for
 * secure, cross-origin communication.
 */
(() => {
  // A map to store pending requests so we can resolve them when a response arrives.
  const pendingRequests = new Map();
  let requestId = 0;

  // Listen for responses from the parent window.
  window.addEventListener('message', (event) => {
    // Basic security: In a real app, you should check event.origin to ensure
    // the message is coming from your main application's domain.
    // Example: if (event.origin !== 'https://your-app-domain.com') return;

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

  /**
   * Sends a request to the parent window and returns a promise that resolves with the response.
   * @param {object} message The message to send to the parent.
   * @returns {Promise<any>}
   */
  function requestFromParent(message) {
    return new Promise((resolve, reject) => {
      const currentId = requestId++;
      pendingRequests.set(currentId, { resolve, reject });
      window.parent.postMessage({ ...message, requestId: currentId }, '*'); // Use a specific target origin in production
    });
  }

  // --- Public API --- //
  // These functions are exposed on the `window` object within the iframe.

  /**
   * Retrieves a document from the project's storage.
   * @param {string} docId The ID of the document to get.
   * @returns {Promise<object | null>} A promise that resolves with the document data or null.
   */
  window.getDocFromStorage = (docId) => {
    return requestFromParent({ type: 'getDoc', docId });
  };

  /**
   * Creates or updates a document in the project's storage.
   * @param {string} docId The ID of the document to set.
   * @param {object} data The data to write.
   * @returns {Promise<{success: boolean}>}
   */
  window.setDocInStorage = (docId, data) => {
    return requestFromParent({ type: 'setDoc', docId, data });
  };

  /**
   * Deletes a document from the project's storage.
   * @param {string} docId The ID of the document to delete.
   * @returns {Promise<{success: boolean}>}
   */
  window.deleteDocFromStorage = (docId) => {
    return requestFromParent({ type: 'deleteDoc', docId });
  };

  /**
   * Deletes a specific field from a document.
   * @param {string} docId The ID of the document to update.
   * @param {string} fieldName The name of the field to delete.
   * @returns {Promise<{success: boolean}>}
   */
  window.deleteFieldFromDoc = (docId, fieldName) => {
    return requestFromParent({ type: 'deleteField', docId, fieldName });
  };

  /**
   * Lists all documents in the project's storage.
   * @returns {Promise<Array<object>>} A promise that resolves with an array of documents.
   */
  window.listDocsInStorage = () => {
    return requestFromParent({ type: 'listDocs' });
  };

})();
