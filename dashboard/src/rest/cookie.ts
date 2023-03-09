export function setCookie(name: string, value: string, expireDays: number): string {
    const date = new Date();

        date.setTime(date.getTime() + (expireDays * 24 * 60 * 60 * 1000));

    const expires = "expires=" + date.toUTCString();
    const cookie = name + "=" + value + ";" + expires + ";path=/";

    document.cookie = cookie;

    return cookie;
}

export function getCookie(name: string): string|null {
    let cookie = name + "=";
    let decodedCookie = decodeURIComponent(document.cookie);
    let ca = decodedCookie.split(';');

    for(let i = 0; i <ca.length; i++) {
        let c = ca[i];

        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }

        if (c.indexOf(cookie) == 0) return c.substring(cookie.length, c.length);
    }

    return null;
  }
