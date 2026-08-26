export function compteur() {
    let reussis = 0;
    let echoues = 0;
    function check(nom, condition, detail = '') {
        if (condition) { reussis++; console.log(`  ✓ ${nom}`); }
        else { echoues++; console.error(`  ✗ ${nom}${detail ? ` — ${detail}` : ''}`); }
    }
    function proche(nom, actuel, attendu, tolerance = 1e-6) {
        check(nom, Math.abs(actuel - attendu) <= tolerance, `${actuel} au lieu de ${attendu}`);
    }
    function egal(nom, actuel, attendu) {
        check(nom, JSON.stringify(actuel) === JSON.stringify(attendu), `${JSON.stringify(actuel)} au lieu de ${JSON.stringify(attendu)}`);
    }
    function rapport() {
        console.log(`\n  ${reussis} vérifications réussies${echoues ? `, ${echoues} échouée(s)` : ''}.\n`);
        if (echoues) process.exitCode = 1;
    }
    return { check, proche, egal, rapport };
}

