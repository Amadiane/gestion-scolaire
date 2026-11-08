const INDICATIF = '224'; // Guinée : ajouté aux numéros locaux de 9 chiffres

export const numeroWhatsApp = (tel) => {
  let n = String(tel || '').replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  else if (n.length <= 9) n = INDICATIF + n.replace(/^0+/, '');
  return n.replace(/\D/g, '');
};

export const lienWhatsApp = (tel, message) =>
  `https://wa.me/${numeroWhatsApp(tel)}?text=${encodeURIComponent(message)}`;