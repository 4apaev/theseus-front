import { svg } from 'lit'

const paths: Record<string, string> = {
    port    : 'M3 10 12 5l9 5v9l-9 5-9-5Zm0 0 9 5 9-5M12 15v9M12 5V1',
    rig     : 'm12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7m9 5v10',
    market  : 'M3 7h18v14H3Zm-1 0 3-5h14l3 5M8 12h8M8 16h5',
    cargo   : 'M3 9h18v13H3ZM3 9l4-5h10l4 5M12 9V4M8 15h8',
    comms   : 'M8 6a8 8 0 0 0 0 12M16 6a8 8 0 0 1 0 12M5 3a12 12 0 0 0 0 18M19 3a12 12 0 0 1 0 18M12 10v4m-2-2h4',
    orbit   : 'm12 2 9 20-9-5-9 5ZM12 2v15',
    map     : 'M5 17 11 7l9 10M5 17h15M11 4v6M8 7h6M3 15v4h4v-4Zm15 0v4h4v-4Z',
    arrow   : 'M4 12h16m-6-6 6 6-6 6',
    plus    : 'M12 5v14M5 12h14',
    minus   : 'M5 12h14',
    reset   : 'M5 8a8 8 0 1 1-1 7M5 3v5h5',
    close   : 'm6 6 12 12M6 18 18 6',
    pause   : 'M8 5v14M16 5v14',
    play    : 'm8 4 12 8-12 8Z',
    check   : 'm5 12 5 5L20 7',
    settings: 'M4 7h16M4 13h16M4 19h16M9 4v6M15 10v6M12 16v6',
}
export function icon(name: string) {
    return svg`
        <svg
            viewBox="0 0 24 26"
            fill="none"
            stroke="currentColor"
            stroke-width="1.4"
            stroke-linecap="square"
            stroke-linejoin="miter"
            aria-hidden="true"
        >
            <path d=${ paths[ name ] ?? paths.rig }/>
        </svg>`
}
