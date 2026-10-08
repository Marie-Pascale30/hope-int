// Balise <hl> des messages : mot surligne dans un titre.
// t.rich("title", { hl }) ; utilisable dans les composants serveur comme client.
import Highlight from "./Highlight";

export const hl = (chunks) => <Highlight>{chunks}</Highlight>;
