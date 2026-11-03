// Réduit une photo (640 px max, JPEG) avant de la ranger dans la file d'attente :
// une photo de téléphone brute pèserait plusieurs Mo.
export function redimensionnerPhoto(fichier, max = 640, qualite = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      const echelle = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * echelle);
      canvas.height = Math.round(img.height * echelle);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', qualite));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('photo_illisible'));
    };
    img.src = url;
  });
}