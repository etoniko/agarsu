/** Читает UTF-16 аватар аккаунта после поля xp (Reader) */
export function readAccountAvatar(reader) {
    const avatarLen = reader.getUint16();
    let accountAvatar = "";
    for (let i = 0; i < avatarLen; i++) {
        accountAvatar += String.fromCharCode(reader.getUint16());
    }
    return accountAvatar;
}

/** Читает UTF-16 аватар аккаунта (BinaryReader) */
export function readAccountAvatarBinary(reader) {
    const avatarLen = reader.uint16();
    let accountAvatar = "";
    for (let i = 0; i < avatarLen; i++) {
        accountAvatar += String.fromCharCode(reader.uint16());
    }
    return accountAvatar;
}
