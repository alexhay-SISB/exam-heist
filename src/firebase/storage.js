import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from './config';

export const uploadPDF = async (file, bankId) => {
  const fileRef = ref(storage, `pdfs/${bankId}/${file.name}`);
  await uploadBytes(fileRef, file);
  return await getDownloadURL(fileRef);
};

export const deletePDF = async (path) => {
  const fileRef = ref(storage, path);
  await deleteObject(fileRef);
};
