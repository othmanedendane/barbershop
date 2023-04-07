const REDIRECT_ERROR_CODE = 'NEXT_REDIRECT';
/**
 * When used in a React server component, this will insert a meta tag to
 * redirect the user to the target page. When used in a custom app route, it
 * will serve a 302 to the caller.
 *
 * @param url the url to redirect to
 */ export function redirect(url) {
    // eslint-disable-next-line no-throw-literal
    const error = new Error(REDIRECT_ERROR_CODE);
    error.digest = `${REDIRECT_ERROR_CODE};${url}`;
    throw error;
}
/**
 * Checks an error to determine if it's an error generated by the
 * `redirect(url)` helper.
 *
 * @param error the error that may reference a redirect error
 * @returns true if the error is a redirect error
 */ export function isRedirectError(error) {
    return typeof (error == null ? void 0 : error.digest) === 'string' && error.digest.startsWith(REDIRECT_ERROR_CODE + ';') && error.digest.length > REDIRECT_ERROR_CODE.length + 1;
}
export function getURLFromRedirectError(error) {
    if (!isRedirectError(error)) return null;
    // Slices off the beginning of the digest that contains the code and the
    // separating ';'.
    return error.digest.slice(REDIRECT_ERROR_CODE.length + 1);
}

//# sourceMappingURL=redirect.js.map