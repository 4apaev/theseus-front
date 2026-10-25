type SRaw  = Parameters<typeof String.raw>
type Dict  = Record<string, SpeechSynthesisVoice>
type Voice = Record<string, (...a: SRaw) => void>

// apple's novelty voices: sound effects, not people
const NOVELTY = new Set([
    'albert', 'bad news', 'bahh', 'bells', 'boing', 'bubbles', 'cellos', 'good news',
    'jester', 'organ', 'superstar', 'trinoids', 'whisper', 'wobble', 'zarvox',
])

export const voices: Dict = Object.create(null)

// chrome fills the list late, on `voiceschanged`. an english voice wins its name.
function load() {
    for (const voice of speechSynthesis.getVoices()) {
        const name = voice.name.split('(')[ 0 ].trim().toLowerCase()
        if (NOVELTY.has(name) || voices[ name ]?.lang.startsWith('en')) continue
        voices[ name ] = voice
    }
}

load()
speechSynthesis.addEventListener('voiceschanged', load)

export function speak(text: string, voice?: SpeechSynthesisVoice) {
    const su = new SpeechSynthesisUtterance(text)
    su.voice = voice ?? voices.kate ?? null
    speechSynthesis.speak(su)
}

/** a voice by name, as a template tag: Px.samantha`arrived`. */
export const Px = new Proxy(voices, {
    get(tr: Dict, k: string) {
        return (...a: SRaw): void =>
            speak(String.raw(...a), tr[ k ])
    },
}) as unknown as Voice

export default Px

/*
    english voices:
    ----------------------------------------------------------------------------
    karen      albert     grandpa
    kate       bad news   jester
    kathy      bahh       junior
    moira      bells      trinoids
    organ      boing      whisper
    ralph      bubbles    wobble
    reed       cellos     zarvox
    rishi      clayton
    rocko      daniel
    samantha   eddy
    sandy      flo
    shelley    fred
    superstar  good news
    tessa      grandma
    ----------------------------------------------------------------------------
    bad news    cellos      ellen       grandpa     kanya       lekha       albert
    bahh        clayton     flo         ioana       karen       lesya       alice
    bells       damayanti   fred        jacques     kathy       linh        alva
    boing       daniel      geeta       jester      kyoko       luciana     amélie
    bubbles     daria       good news   joana       lana        majed       amira
    carmit      eddy        grandma     junior      laura       meijia      anna
    melina      organ       rocko       sinji       tingting    xander
    milena      paulina     samantha    soumya      trinoids    yelda
    moira       piya        sandy       superstar   tünde       yuna
    mónica      ralph       sara        tessa       vani        zarvox
    montse      reed        satu        thomas      whisper     zosia
    nora        rishi       shelley     tina        wobble      zuzana

*/
