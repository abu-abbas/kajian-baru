const text = "*☪️Untuk Wilayah DKI Jakarta & sekitarnya☪️*";
const kotaMatch = text.match(/(?:daerah|Wilayah)\s+([^&\n,]+?)(?:\s+dan\s+sekitarnya|\s+&|\n|$)/i);
console.log("kotaMatch:", kotaMatch);
