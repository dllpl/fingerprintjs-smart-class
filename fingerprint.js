/**
 * Класс для работы с сервисом FingerprintJS.
 * Особенности реализации:
 * 1) Сессионный подход на основе файлов cookie - позволяет сократить кол-во запрос к сервису FingerprintJS.
 * 2) Определяет ref url клиента.
 * 3) Возможно применить совместно со средствами метрики Google и Яндекс.
 *
 * @author Nikita Iv
 * mailto:nick.iv.dev@gmail.com
 * https://github.com/dllpl
 */
class FingerPrint {

    token
    fingerprint
    fp_session_id

    pixelUserId
    pixelSessId
    pixelUserFp

    constructor() {
        this.token = ''
        this.endpoint = ''
        this.fingerPrintInitUrl = ''
        this.fingerPrintSaveUrl = ''

        this.fingerprint = this.getCookieByObj('fingerprint')
        this.fp_session_id = this.getCookie('_fp_session_id')
        this.getPixel()
    }

    fpStart(event, phone = '') {
        if (!this.fp_session_id) {
            this.setCookie('_fp_session_id')
            this.fp_session_id = this.getCookie('_fp_session_id')
        }
        if (!this.fingerprint) {
            this.fpInit({
                token: this.token,
                endpoint: this.endpoint,
                fp_session_id: this.fp_session_id,
                fpEvent: event
            })
        } else if (this.fingerprint && event) {
            this.fpSave({
                fpEvent: event,
                visitorId: this.fingerprint.visitorId,
                sessionId: this.fingerprint.sessionId,
                phone: phone
            })
        }
    }

    /** Инициируем fingerprint */
    fpInit(params) {
        setTimeout(() => {
            const self = this
            const fpPromise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.onload = resolve;
                script.onerror = reject;
                script.async = true;
                script.src = 'https://cdn.jsdelivr.net/npm/'
                    + '@fingerprintjs/fingerprintjs-pro@3/dist/fp.min.js';
                document.head.appendChild(script);
            }).then(() => {
                return FingerprintJS.load({apiKey: params.token, endpoint: params.endpoint});
            })

            fpPromise
                .then(fp => fp.get({}))
                .then(result => {
                    $.ajax({
                        type: "POST",
                        contentType: "application/json; charset=utf-8",
                        url: this.fingerPrintInitUrl,
                        data: JSON.stringify({
                            visitorId: result.visitorId,
                            sessionId: params.fp_session_id,
                            fpEvent: 5,
                            score: result.confidence.score.toString(),

                            pixelUserId: this.pixelUserId ?? null,
                            pixelSessId: this.pixelSessId ?? null,
                            pixelUserFp: this.pixelUserFp ?? null,

                            url: document.location.href ?? null,
                            ref_url: this.getRefUrl() ?? null,
                            yandexClientId: this.getYandexClientId() ?? null,
                            googleClientId: this.getGoogleClientId() ?? null,
                        }),
                        success: function (data) {
                            self.setCookie('fingerprint', JSON.stringify({
                                visitorId: result.visitorId,
                                sessionId: params.fp_session_id
                            }))
                        }
                    });
                })
        }, 1000)
    }

    fpSave(params) {
        setTimeout(() => {
            if (params.fpEvent === 10) {
                params.phone = params.phone.replace(/[-() ]/g, '')
            }

            $.ajax({
                type: "POST",
                url: this.fingerPrintSaveUrl,
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify({
                    visitorId: params.visitorId,
                    sessionId: params.sessionId,
                    fpEvent: params.fpEvent,
                    phone: params.phone ?? null,

                    pixelUserId: this.pixelUserId ?? null,
                    pixelSessId: this.pixelSessId ?? null,
                    pixelUserFp: this.pixelUserFp ?? null,

                    url: document.location.href ?? null,
                    ref_url: this.getRefUrl() ?? null,
                    yandexClientId: this.getYandexClientId() ?? null,
                    googleClientId: this.getGoogleClientId() ?? null,
                }),
            });
        }, 1000)
    }

    getCookie(name) {
        let matches = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"));
        return matches ? decodeURIComponent(matches[1]) : undefined;
    }

    getCookieByObj(name) {
        let nameEQ = name + "=";
        let ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return JSON.parse(decodeURIComponent(c.substring(nameEQ.length, c.length)))
        }
        return null;
    }


    setCookie(name, data = null) {
        if (!data) {
            let session_id = Math.random().toString(12).substr(2, 15);
            document.cookie = `${name}=${session_id};max-age=3600;path=null`
        } else {
            document.cookie = `${name}=${data};max-age=3600;path=null`
        }
    }

    getGoogleClientId() {
        let match = document.cookie.match('(?:^|;)\\s*_ga=([^;]*)'),
            raw = match ? decodeURIComponent(match[1]) : null;
        if (raw) {
            match = raw.match(/(\d+\.\d+)$/)
        }
        return (match) ? match[1] : null;
    }

    getYandexClientId() {
        let match = document.cookie.match('(?:^|;)\\s*_ym_uid=([^;]*)');
        return (match) ? decodeURIComponent(match[1]) : false;
    }

    getRefUrl() {
        return document.referrer
    }

    getPixel() {
        const loadScript = new Promise((resolve) => {
            window.pixel_partner_id = 6898;
            window.pixel_partner_uid = null;

            let pixel_stat = document.createElement('script')

            pixel_stat.type = 'text/javascript'
            pixel_stat.async = true
            pixel_stat.src = '//pixel.kbki.ru/pixel.js'

            let pixel_stat_s = document.getElementsByTagName('script')[0]
            pixel_stat_s.parentNode.insertBefore(pixel_stat, pixel_stat_s)

            pixel_stat.addEventListener('load', () => {
                resolve()
            })

        });

        loadScript.then(() => {
            let sessionPromise = Fingerprint2.getPromise()
            pixel_getStat()
            sessionPromise.then(res => {
                this.pixelUserId = window.pixel_user_id
                this.pixelSessId = window.pixel_sess_id
                this.pixelUserFp = this.getCookie('pixel_user_fp')
            })
        });
    }
}

new FingerPrint().fpStart(5);

