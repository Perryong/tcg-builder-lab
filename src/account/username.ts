export function normalizeUsername(input:string):string{
 const name=input.trim().toLowerCase();
 if(!/^[a-z0-9_]{3,24}$/.test(name))throw Error('Use 3–24 letters, numbers, or underscores.');
 return name;
}
