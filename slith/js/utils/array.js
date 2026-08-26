export function removeFromArray(arr, item) {
  const i = arr.indexOf(item);
  return i !== -1 && arr.splice(i, 1);
}
