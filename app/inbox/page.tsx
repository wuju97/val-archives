"use client";

import { useState } from "react";
import Link from "next/link";
import { hasGeminiKey, geminiSmartCategoryReview, geminiGenerateSavePrompt, geminiErrorMessage, geminiClassifyText } from "../../lib/geminiEngine";
import {
  addEntry, replaceEntry, loadArchive, saveArchive,
  detectContradiction, regenerateMasterPrompt,
  CATEGORY_LABELS, CATEGORY_ICONS, StoryCategory, VaultEntry, ArchiveData,
} from "@/lib/archiveEngine";

type Suggestion = { text: string; category: StoryCategory };
type ContradictionState = {
  existingEntry: VaultEntry; newText: string; category: StoryCategory;
  remainingQueue: Suggestion[]; currentArchive: ArchiveData;
};

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as StoryCategory[];

// ─── DEFAULT SAVE EXTRACTION PROMPT ──────────────────────────────────────────

const DEFAULT_SAVE_PROMPT = `# SESSION SAVE — EXTRACTION REQUEST

You are about to help me save my current story/RPG session so I can continue it later with full continuity. Please answer every section below as completely and accurately as possible based on everything that has happened in our session together. Be thorough — missing details will break continuity.

---

## 1. SESSION SUMMARY
Write a detailed paragraph summarizing everything that happened in this session from beginning to end. Include the major beats, turning points, and how the tone shifted.

## 2. CURRENT SCENE
Describe exactly where we are right now:
- Location (name, description, atmosphere)
- Time of day and current conditions
- Who is physically present
- What was happening the moment we stopped

## 3. MY CHARACTER — CURRENT STATUS
- Full name and any titles or aliases
- Current physical appearance and condition (injuries, fatigue, equipment worn)
- Current emotional and psychological state
- Any abilities, powers, or skills used or revealed this session
- Current inventory (important items, weapons, artifacts)
- Any changes to the character from this session

## 4. KEY CHARACTERS ENCOUNTERED
For each significant character met or interacted with this session:
- Name and role
- What was said or revealed
- Current relationship with my character (trust level, tone, attitude)
- Any secrets, lies, or hidden information they carry

## 5. RELATIONSHIPS — CHANGES THIS SESSION
- Which relationships deepened, shifted, or broke
- Any new bonds formed
- Any betrayals, surprises, or emotional moments between characters

## 6. NEW LORE AND WORLD FACTS REVEALED
- History, myths, or secrets learned
- Rules of the world clarified
- Locations discovered or described in detail
- Organizations, factions, or powers revealed

## 7. ACTIVE QUESTS AND OBJECTIVES
For each active quest:
- Quest name and goal
- Who gave it and why
- Progress made this session
- Current obstacles or complications

## 8. UNRESOLVED THREADS
- Open mysteries or unanswered questions
- Conflicts left unresolved
- Promises made or debts owed
- Story hooks planted for future sessions

## 9. SIGNIFICANT DECISIONS MADE
List every major choice made this session, what options were available, what was chosen, and what the immediate consequence was.

## 10. WHAT HAPPENS NEXT
Based on exactly where we stopped:
- What is the immediate situation when we resume?
- What threats or opportunities are active?
- What does my character need to do first?

---

Please answer every section. Do not skip or abbreviate. This information will be used to reconstruct the session in full detail.`;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE CLASSIFIER ENGINE
// Built from analysis of: fantasy novels, RPG sourcebooks, mythology, sci-fi,
// horror, romance, political drama, historical fiction, and worldbuilding guides
// ═══════════════════════════════════════════════════════════════════════════════

// ─── KNOWN NAMED ENTITIES ────────────────────────────────────────────────────

const KNOWN_CHARACTERS = new Set([
  // Harry Potter
  "harry","hermione","ron","dumbledore","voldemort","snape","malfoy","draco",
  "luna","neville","ginny","fred","george","sirius","lupin","hagrid","mcgonagall",
  "bellatrix","dobby","kreacher","percy","arthur","molly","fleur","viktor","cedric",
  "cho","lavender","trelawney","umbridge","quirrell","lockhart","moody","tonks",
  "kingsley","slughorn","sprout","flitwick","pomfrey","filch","lily","james",
  "peter","regulus","narcissa","lucius","crabbe","goyle","pansy","blaise","seamus",
  "dean","colin","oliver","angelina","katie","alicia","lee","parvati","padma",
  "myrtle","peeves","aragog","fawkes","hedwig","crookshanks","scabbers","norbert",
  "buckbeak","grawp","firenze","bane","ronan","valefor","nightfrost",
  // Common fantasy names
  "gandalf","aragorn","legolas","gimli","frodo","sam","merri","pippin","bilbo",
  "sauron","saruman","gollum","arwen","elrond","galadriel","boromir","faramir",
  "thorin","balin","dwalin","smaug","radagast","tauriel","thranduil","bard",
  "geralt","yennefer","ciri","jaskier","triss","dandelion","eredin","gaunter",
  "daenerys","jon","tyrion","cersei","jaime","arya","sansa","bran","ned","robb",
  "stannis","melisandre","davos","jorah","bronn","littlefinger","varys","oberyn",
  "naruto","sasuke","sakura","kakashi","itachi","orochimaru","jiraiya","tsunade",
  "goku","vegeta","gohan","piccolo","frieza","cell","beerus","broly",
  "luffy","zoro","nami","usopp","sanji","chopper","robin","franky","brook",
]);

const KNOWN_LOCATIONS = new Set([
  // Harry Potter
  "hogwarts","hogsmeade","diagon alley","knockturn alley","azkaban","the burrow",
  "ministry of magic","forbidden forest","chamber of secrets","room of requirement",
  "great hall","godric's hollow","privet drive","gringotts","grimmauld place",
  "shrieking shack","astronomy tower","quidditch pitch","platform nine","kings cross",
  "leaky cauldron","three broomsticks","hog's head","ollivanders","honeydukes",
  "borgin and burkes","st mungos","department of mysteries","malfoy manor",
  // LOTR
  "mordor","rivendell","lothlórien","minas tirith","rohan","gondor","the shire",
  "isengard","helms deep","khazad dum","moria","fangorn","pelennor fields",
  "weathertop","bree","bag end","erebor","dale","mirkwood","dol guldur",
  // Generic fantasy
  "the dungeon","the tower","the vault","the castle","the forest","the temple",
  "the ruins","the cave","the palace","the library","the tavern","the inn",
  "the market","the arena","the throne room","the courtyard","the battlefield",
  "the graveyard","the sewers","the catacombs","the docks","the harbor",
  "the capital","the citadel","the keep","the watchtower","the camp",
  "his home","her home","their home","the home","his house","her house",
  // Generic real-world
  "arizona","london","paris","new york","tokyo","rome","egypt","venice",
  "jerusalem","moscow","berlin","beijing","dubai","mumbai","sydney",
]);

const KNOWN_ARTIFACTS = new Set([
  "nightfrost","elder wand","invisibility cloak","resurrection stone",
  "philosopher's stone","sorcerer's stone","horcrux","deathly hallows",
  "marauder's map","time turner","sorting hat","sword of gryffindor",
  "one ring","palantir","silmaril","mithril","sting","glamdring","anduril",
  "excalibur","mjolnir","gungnir","durandal","joyeuse","curtana",
  "triwizard cup","goblet of fire","prophecy orb","mirror of erised",
  "death note","sharingan","rinnegan","byakugan","mangekyou",
]);

const NOISE_WORDS = new Set([
  "the","a","an","this","that","he","she","it","they","we","his","her","its",
  "their","our","my","your","year","day","time","place","thing","way","man",
  "woman","person","people","great","old","new","young","first","last","next",
  "current","former","late","early","group","team","some","many","few","all",
  "one","two","three","very","just","also","even","still","back","then","than",
  "when","where","while","after","before","since","until","because","and","or",
  "but","if","so","is","are","was","were","be","been","being","has","have","had",
  "do","does","did","will","would","could","should","may","might","shall","must",
  "can","not","no","yes","get","got","make","made","take","took","give","gave",
  "see","saw","know","knew","think","thought","feel","felt","want","need","use",
  "eat","ate","drink","drank","like","go","went","come","came","food","water",
  "fast","slow","big","small","good","bad","long","short","high","low","dark",
  "light","true","false","same","other","such","more","less","most","least",
  "too","enough","almost","never","always","often","sometimes","usually",
  "really","actually","probably","already","around","about","through","over",
  "under","between","among","during","without","within","against","toward",
  "upon","into","onto","away","down","up","off","out","here","there","now",
  "then","today","yesterday","tomorrow","something","anything","nothing",
  "everything","everyone","anyone","someone","no one","somewhere","anywhere",
  "nowhere","everywhere","however","therefore","although","because","whether",
  "whom","whose","which","what","whatever","whoever","whichever",
]);

const NON_LOCATION_WORDS = new Set([
  "eating","drinking","sleeping","running","walking","talking","saying","doing",
  "making","taking","giving","seeing","knowing","thinking","feeling","wanting",
  "needing","using","having","being","becoming","getting","junk","fun","danger",
  "trouble","pain","joy","luck","chance","reason","sure","certain","able","ready",
  "free","safe","happy","sad","angry","afraid","sorry","tired","fat","thin","hot",
  "cold","warm","cool","wet","dry","hard","soft","loud","quiet","heavy","clean",
  "secret","hidden","ancient","sacred","holy","dark","light","great","evil","good",
  "powerful","weak","strong","magic","magical","dead","alive","lost","found",
  "war","peace","love","hate","truth","lie","blood","fire","water","earth","wind",
  "power","strength","wisdom","knowledge","death","life","time","space","world",
  "nothing","something","everything","anything","someone","everyone","anyone",
]);

// ─── COMPREHENSIVE KEYWORD LISTS ──────────────────────────────────────────────

// LOCATIONS — physical places
const LOC_SUFFIXES = [
  "castle","fortress","citadel","stronghold","keep","bastion","battlement",
  "tower","spire","turret","dungeon","vault","crypt","tomb","catacomb","ruin",
  "forest","wood","grove","thicket","jungle","rainforest","woodland","glade",
  "marsh","swamp","bog","mire","fen","wetland","tundra","taiga","steppe",
  "desert","wasteland","badland","canyon","gorge","ravine","valley","dale",
  "mountain","peak","summit","ridge","cliff","crag","plateau","highland",
  "cave","cavern","grotto","tunnel","mine","shaft","pit","hollow","burrow",
  "lake","pond","pool","reservoir","river","stream","creek","brook","waterfall",
  "sea","ocean","bay","gulf","strait","channel","coast","shore","beach","reef",
  "island","archipelago","peninsula","cape","delta","estuary",
  "temple","shrine","cathedral","church","chapel","monastery","convent","altar",
  "palace","manor","mansion","estate","villa","chateau","hall","lodge","keep",
  "city","town","village","hamlet","settlement","colony","outpost","camp",
  "port","harbor","dock","wharf","pier","quay","anchorage",
  "market","bazaar","plaza","square","district","quarter","ward","borough",
  "road","path","trail","route","pass","bridge","crossing","ford","gate",
  "arena","colosseum","stadium","amphitheater","theater","court","gallery",
  "library","archive","academy","school","university","institute","laboratory",
  "prison","jail","dungeon","fortress","garrison","barracks","armory",
  "tavern","inn","pub","alehouse","guesthouse","hostel","lodge",
  "shop","store","market","emporium","workshop","forge","smithy","mill",
  "farm","plantation","estate","ranch","homestead","village","compound",
  "headquarters","base","outpost","station","post","stronghold","sanctuary",
  "hospital","clinic","healers","apothecary","asylum","sanctum",
  "dimension","plane","realm","world","universe","void","abyss","ether",
  "battlefield","warzone","siege","frontline","trench",
];

const LOC_CONTEXT_WORDS = [
  "arrived at","located in","found in","hidden in","lives in","lives at",
  "based in","situated in","traveled to","went to","moved to","escaped to",
  "fled to","returned to","heading to","born in","raised in","grew up in",
  "stationed at","imprisoned in","exiled to","banished to","hiding in",
  "hiding at","met at","met in","studied at","trained at","works at",
  "works in","built in","constructed in","destroyed in","burned in",
  "entered","left from","departed from","arrived from","came from",
  "passed through","traveled through","journeyed to","sailed to",
  "marched to","retreated to","advanced toward","besieged","defended",
];

// CHARACTERS — named beings
const CHAR_WORDS = [
  "protagonist","antagonist","hero","heroine","villain","anti-hero","antihero",
  "knight","warrior","mage","wizard","witch","sorcerer","sorceress","warlock",
  "druid","ranger","rogue","assassin","thief","bard","monk","paladin","cleric",
  "priest","priestess","shaman","oracle","prophet","seer","sage","scholar",
  "king","queen","prince","princess","emperor","empress","lord","lady",
  "duke","duchess","baron","baroness","count","countess","earl","marquis",
  "general","captain","admiral","commander","lieutenant","sergeant","soldier",
  "guard","knight","squire","page","herald","messenger","spy","assassin",
  "merchant","trader","blacksmith","alchemist","healer","innkeeper","farmer",
  "hunter","ranger","scout","explorer","adventurer","mercenary","bounty hunter",
  "thief","bandit","pirate","corsair","smuggler","outlaw","criminal",
  "elder","elder","chief","chieftain","shaman","warchief","overlord","tyrant",
  "champion","chosen one","heir","successor","exile","outcast","wanderer",
  "god","goddess","deity","demigod","immortal","spirit","ghost","phantom",
  "vampire","werewolf","shapeshifter","demon","angel","divine","celestial",
  "young","old","ancient","legendary","famous","notorious","feared","beloved",
  "named","known as","called","title of","goes by","alias",
];

// RELATIONSHIPS
const REL_VERBS = [
  "loves","secretly loves","is in love with","has feelings for","is attracted to",
  "adores","cherishes","desires","longs for","pines for","has a crush on",
  "hates","despises","loathes","detests","resents","blames","holds grudge",
  "trusts","distrusts","betrayed","deceived","manipulated","lied to",
  "is loyal to","is devoted to","is faithful to","relies on","depends on",
  "fears","is afraid of","is terrified of","respects","admires","idolizes",
  "is friends with","is best friends with","is enemies with","is rivals with",
  "is allies with","is partners with","works alongside","fights alongside",
  "is the father of","is the mother of","is the son of","is the daughter of",
  "is the brother of","is the sister of","is related to","is the heir of",
  "raised","adopted","mentors","teaches","trained by","guided by",
  "tells","told","confessed to","warned","threatened","promised","swore to",
  "apologized to","forgave","thanked","blamed","challenged","dueled",
  "married","betrothed","courting","divorced","separated","widowed",
  "allied with","sworn enemy of","blood feud","rivalry between",
  "is jealous of","envies","is competitive with","outmatched by",
  "bonded with","connected to","linked to","bound to","sworn to",
];

// TIMELINE / EVENTS
const TIMELINE_VERBS = [
  // Discovery
  "discovered","found","uncovered","revealed","exposed","detected","identified",
  "unearthed","stumbled upon","came across","happened upon","located",
  // Death & birth
  "died","was killed","murdered","executed","slain","fell","perished","sacrificed",
  "was born","born","gave birth","created","spawned","summoned","conjured",
  // Movement & change
  "arrived","left","escaped","fled","retreated","advanced","returned","departed",
  "traveled","journeyed","moved","entered","exited","crossed","reached","passed",
  "ascended","descended","rose","fell","climbed","plunged","dived","soared",
  // Combat & conflict
  "defeated","conquered","captured","imprisoned","freed","liberated","surrendered",
  "attacked","invaded","besieged","stormed","raided","pillaged","destroyed",
  "demolished","burned","razed","collapsed","crumbled","fell","was overthrown",
  // Social & political
  "joined","left","founded","established","disbanded","dissolved","created",
  "married","divorced","betrayed","allied","declared war","signed","agreed",
  "refused","abdicated","crowned","coronated","ascended","dethroned",
  "overthrew","usurped","claimed","inherited","seized","surrendered",
  // Magic & supernatural
  "awakened","transformed","cursed","enchanted","possessed","corrupted",
  "purified","healed","resurrected","reincarnated","banished","exiled",
  "summoned","dismissed","bound","freed","unleashed","contained","sealed",
  // Achievement
  "graduated","trained","mastered","learned","discovered","invented","built",
  "completed","failed","succeeded","achieved","accomplished","won","lost",
  // Communication
  "announced","declared","proclaimed","published","revealed","confessed",
  "admitted","denied","claimed","swore","promised","broke","fulfilled",
  // Time markers
  "in the morning","at night","at dawn","at dusk","at noon","at midnight",
  "yesterday","last night","this morning","tonight","at sunrise","at sunset",
  "years ago","centuries ago","long ago","recently","just now","moments ago",
  "in the past","in ancient times","during the war","after the battle",
  "before the fall","when the kingdom","when the empire","at the height of",
  "in the age of","during the reign of","after the death of",
];

// MAGIC & SUPERNATURAL
const MAGIC_WORDS = [
  // Types of magic
  "spell","curse","charm","hex","jinx","cantrip","invocation","evocation",
  "conjuration","divination","enchantment","illusion","transmutation","abjuration",
  "necromancy","druidcraft","arcane","divine","natural","elemental","shadow",
  "blood magic","death magic","life magic","void magic","chaos magic","order magic",
  "dark magic","light magic","forbidden magic","ancient magic","wild magic",
  "runic magic","sigil magic","ritual magic","ceremony","rite","consecration",
  // Delivery
  "cast","casting","channeled","invoked","summoned","conjured","manifested",
  "woven","shaped","molded","imbued","infused","charged","activated","triggered",
  "potion","brew","elixir","tincture","draught","concoction","infusion","salve",
  "incantation","chant","prayer","mantra","ward","barrier","shield","aegis",
  "portal","vortex","rift","tear","nexus","node","ley line","conduit",
  // Sources & systems
  "mana","arcane energy","magical power","life force","chi","ki","chakra","aura",
  "souls","essence","vitality","spiritual power","divine power","dark energy",
  "rune","sigil","glyph","symbol","inscription","seal","binding","contract",
  "school of magic","magical law","rule of magic","cost of magic","toll",
  "limitation","restriction","forbidden","taboo","dangerous","unstable",
  // Specific magic types
  "telepathy","telekinesis","pyrokinesis","cryokinesis","electrokinesis",
  "healing","restoration","purification","blessing","consecration","holy",
  "curse","blight","plague","corruption","taint","dark","shadow","void",
  "shapeshifting","polymorph","transformation","metamorphosis","lycanthropy",
  "time magic","temporal","chrono","prophecy","vision","foresight","precognition",
  "mind control","domination","compulsion","suggestion","manipulation",
  "illusion","glamour","disguise","phantasm","mirage","hallucination",
  "summoning","binding","banishment","exorcism","sealing","containment",
  "levitation","flight","teleportation","apparition","phasing","invisibility",
  // Specific systems
  "patronus","horcrux","legilimency","occlumency","animagus","metamorphmagus",
  "parseltongue","ninjutsu","genjutsu","taijutsu","sharingan","jutsu","chakra",
  "alchemy","transmutation","equivalent exchange","philosopher's stone",
  "force","the force","force push","force pull","force lightning","jedi","sith",
  "bending","waterbending","firebending","earthbending","airbending","avatar",
  "magic system","power system","ability","gift","talent","power","skill",
  "magical creature","familiar","spirit animal","totem","companion",
  "spellbook","grimoire","tome","scroll","codex","manual","treatise",
  "wand","staff","orb","crystal ball","amulet","talisman","focus","catalyst",
];

// LOCATIONS — context words (strong signals)
const PLACE_VERBS = [
  "ruled","governed","controlled","dominated","conquered","liberated",
  "settled","founded","built","destroyed","abandoned","haunted","cursed",
  "protected","defended","sieged","attacked","occupied","contested",
  "located","situated","nestled","perched","hidden","concealed","secret",
  "ancient","ruins of","remains of","site of","place of","land of",
  "kingdom of","empire of","realm of","domain of","territory of",
  "north of","south of","east of","west of","between","beyond","beneath",
  "above","within","surrounding","bordering","neighboring","adjacent",
];

// HISTORY
const HISTORY_WORDS = [
  "history","historical","ancient","prehistoric","antiquity","classical",
  "medieval","renaissance","modern","contemporary","premodern",
  "era","age","epoch","period","century","decade","millennium","dynasty",
  "founding","origin","beginning","start","creation","birth","establishment",
  "end","fall","collapse","dissolution","destruction","extinction","decline",
  "war","battle","siege","campaign","crusade","conquest","invasion","raid",
  "revolution","rebellion","uprising","coup","insurrection","civil war",
  "empire","kingdom","nation","state","republic","confederation","alliance",
  "rise","ascent","golden age","peak","height","decline","fall","ruin",
  "disaster","catastrophe","cataclysm","apocalypse","plague","famine","flood",
  "treaty","peace","armistice","truce","alliance","pact","agreement","accord",
  "discovery","invention","breakthrough","milestone","achievement","first",
  "legend based on","historically","in history","historical record","chronicle",
  "lore says","it is said","according to legend","the old stories","ancient texts",
];

// LORE & MYTHOLOGY
const LORE_WORDS = [
  "myth","mythology","mythological","legend","legendary","folkloric","folklore",
  "creation myth","origin story","how the world was made","in the beginning",
  "cosmology","cosmos","universe","multiverse","planes of existence","afterlife",
  "heaven","hell","underworld","spirit world","dream world","astral plane",
  "god","goddess","deity","divine","pantheon","olympus","asgard","valhalla",
  "demon","devil","daemon","fiend","infernal","abyssal","hellish","evil one",
  "angel","celestial","seraphim","cherubim","heavenly","divine","holy",
  "religion","faith","worship","prayer","ritual","ceremony","sacrifice",
  "church","temple","monastery","cult","sect","heresy","doctrine","scripture",
  "prophecy","foretold","destined","oracle","vision","dream","omen","sign",
  "sacred text","holy book","scripture","tome","codex","gospel","tenet",
  "superstition","belief","taboo","sacred","profane","blessed","cursed",
  "afterlife","reincarnation","soul","spirit","ghost","shade","specter",
  "creation","beginning of time","first age","primordial","chaos","order",
    "cosmic","universal","eternal","infinite","beyond comprehension",
  "the old gods","the new gods","the forgotten ones","the ancients",
  "myth says","legend tells","it is written","the prophecy speaks",
];

// WORLD OVERVIEW & GEOGRAPHY
const WORLD_WORDS = [
  "world","realm","plane","dimension","universe","multiverse","cosmos",
  "continent","landmass","supercontinent","pangaea","new world","old world",
  "region","territory","province","prefecture","county","shire","canton",
  "kingdom","empire","republic","federation","confederacy","alliance",
  "nation","state","country","sovereignty","dominion","principality",
  "geography","topography","landscape","terrain","environment","ecology",
  "climate","weather","season","biome","ecosystem","natural world",
  "map","atlas","cartography","borders","boundaries","frontier","borderland",
  "east","west","north","south","northern","southern","eastern","western",
  "continent","island continent","archipelago","inland","coastal","landlocked",
  "natural resources","ore","mineral","timber","grain","livestock","fish",
  "trade wind","ocean current","tidal","glacial","volcanic","seismic",
];

// POLITICAL SYSTEMS
const POLITICAL_WORDS = [
  "king","queen","prince","princess","emperor","empress","pharaoh","sultan",
  "caliph","khan","tsar","czar","caesar","kaiser","shogun","daimyo","warlord",
  "president","chancellor","prime minister","premier","consul","proconsul",
  "governor","viceroy","regent","steward","seneschal","chamberlain","vizier",
  "minister","secretary","representative","senator","delegate","envoy",
  "noble","nobility","aristocrat","lord","lady","duke","duchess","earl",
  "count","countess","baron","baroness","marquis","viscount","knight",
  "government","administration","regime","rule","reign","power","authority",
  "democracy","republic","monarchy","oligarchy","theocracy","dictatorship",
  "tyranny","anarchy","feudalism","imperialism","colonialism","fascism",
  "constitution","law","decree","edict","proclamation","charter","treaty",
  "parliament","senate","congress","assembly","council","court","tribunal",
  "election","vote","ballot","poll","campaign","politics","political",
  "diplomacy","ambassador","envoy","emissary","delegation","negotiation",
  "alliance","coalition","faction","party","movement","opposition","rebel",
  "succession","heir","inheritance","abdication","coronation","inauguration",
  "revolution","coup","overthrow","usurpation","rebellion","uprising","revolt",
  "corruption","bribery","conspiracy","treason","betrayal","defection",
  "tax","tribute","levy","tariff","toll","tithe","taxation","revenue",
  "law","justice","crime","punishment","execution","imprisonment","exile",
  "military","army","navy","air force","legions","standing army","militia",
  "war","conflict","aggression","invasion","occupation","annexation","siege",
  "propaganda","censorship","surveillance","control","oppression","tyranny",
];

// ORGANIZATIONS
const ORG_WORDS = [
  "guild","order","brotherhood","sisterhood","fellowship","society","club",
  "alliance","league","union","confederation","coalition","consortium",
  "organization","institution","association","foundation","corporation",
  "military","army","legion","regiment","battalion","company","squad",
  "secret society","cabal","conspiracy","underground","resistance","cell",
  "criminal","syndicate","cartel","gang","mob","mafia","thieves guild",
  "religious","church","temple","cult","sect","order","monks","clerics",
  "academy","school","university","institute","college","faculty",
  "government","ministry","bureau","agency","department","office","division",
  "merchant","trading company","trade guild","commerce","consortium",
  "mercenary","company","band","crew","party","adventurers","sellswords",
  "rebel","resistance","freedom fighters","guerrilla","insurgents","patriots",
  "assassins","killers","death squad","enforcers","hitmen","black ops",
  "intelligence","spies","espionage","shadow organization","covert",
  "founded by","led by","headquartered in","operates in","controls","rules",
  "membership","initiation","ranks","hierarchy","chain of command",
];

// FACTIONS & POWER
const FACTION_WORDS = [
  "faction","side","camp","allegiance","loyalty","sworn to","serves",
  "the light","the dark","the balance","neutral","independent","unaffiliated",
  "death eater","order of the phoenix","dumbledore's army","death eaters",
  "slytherin","gryffindor","hufflepuff","ravenclaw",
  "house lannister","house stark","house targaryen","house baratheon",
  "the empire","the rebellion","the resistance","the first order",
  "influence","power","territory","domain","sphere of influence","reach",
  "leader","warlord","champion","representative","voice","head","chief",
    "rival faction","enemy faction","allied faction","neutral party",
  "infighting","internal conflict","schism","split","faction war",
  "ideology","belief","creed","code","doctrine","manifesto","agenda",
  "resource","supply line","funding","support","backing","patron",
];

// ITEMS & EQUIPMENT
const ITEM_WORDS = [
  // Weapons
  "sword","blade","dagger","knife","dirk","rapier","sabre","scimitar","katana",
  "longsword","broadsword","greatsword","shortsword","claymore","falchion",
  "axe","battleaxe","hatchet","tomahawk","cleaver","war axe","greataxe",
  "spear","lance","pike","halberd","glaive","trident","javelin","pole",
  "bow","longbow","shortbow","crossbow","ballista","siege weapon","catapult",
  "arrow","bolt","quarrel","quiver","ammunition","projectile",
  "hammer","mace","flail","morningstar","club","bludgeon","cudgel",
  "staff","wand","rod","scepter","orb","catalyst","focus","implement",
  "gun","pistol","rifle","musket","cannon","firearm","blunderbuss","arquebus",
  "bomb","grenade","explosive","mine","trap","snare","siege engine",
  "whip","chain","net","lasso","bola","throwing star","shuriken",
  // Armor & protection
  "armor","armour","plate","chainmail","mail","ring","scale","leather","hide",
  "helmet","visor","gorget","pauldron","gauntlet","greave","bracer","vambrace",
  "shield","buckler","pavise","aegis","barrier","ward","protection",
  "cloak","robe","vestment","garment","clothing","uniform","livery","tabard",
  // Magical items
  "artifact","relic","talisman","amulet","pendant","charm","fetish","totem",
  "ring","necklace","bracelet","crown","circlet","diadem","tiara","headpiece",
  "crystal","gem","jewel","stone","orb","sphere","globe","lens","prism",
  "scroll","tome","grimoire","spellbook","codex","manuscript","tablet",
  "potion","elixir","draught","brew","concoction","vial","flask","bottle",
  "key","lock","mechanism","device","contraption","invention","gadget",
  "compass","map","chart","instrument","tool","implement","apparatus",
  "seal","sigil","mark","brand","tattoo","inscription","rune","glyph",
  "mirror","scrying glass","crystal ball","viewing orb","lens","telescope",
  "staff of","sword of","ring of","amulet of","tome of","crown of","blade of",
  // General
  "weapon","arms","armament","equipment","gear","kit","loadout","inventory",
  "treasure","loot","plunder","spoils","prize","trophy","reward","bounty",
  "crafted","forged","enchanted","cursed","blessed","imbued","infused",
  "legendary","unique","rare","common","magical","mundane","ordinary",
  "ancient","old","new","broken","repaired","restored","destroyed",
];

// CREATURES & WILDLIFE
const CREATURE_WORDS = [
  // Dragons & wyrms
  "dragon","drake","wyrm","wyvern","lindwurm","basilisk","hydra","sea serpent",
  "leviathan","behemoth","tarrasque","dragon turtle","salamander","fire lizard",
  // Undead
  "undead","zombie","skeleton","revenant","ghoul","wight","wraith","specter",
  "phantom","shade","banshee","lich","vampire","vampyr","nosferatu","spawn",
  "mummy","death knight","bone golem","necromantic","risen","reanimated",
  // Demons & devils
  "demon","devil","fiend","daemon","imp","succubus","incubus","balrog",
  "pit fiend","archdevil","demon lord","abyssal","infernal","hellspawn",
  "demonkin","fallen","corrupted","possessed","dark entity","evil spirit",
  // Angels & celestials
  "angel","archangel","seraphim","cherubim","celestial","divine being",
  "paladin","holy warrior","champion of light","heavenly host","divine servant",
  // Fey & nature spirits
  "fairy","faerie","fey","pixie","sprite","nymph","dryad","naiad","sylph",
  "gnome","brownie","leprechaun","banshee","will-o-wisp","changeling",
  "troll","ogre","giant","titan","colossus","cyclops","ettin","frost giant",
  // Common fantasy creatures
  "goblin","hobgoblin","bugbear","kobold","gnoll","lizardfolk","merfolk",
  "centaur","minotaur","harpy","medusa","gorgon","chimera","manticore",
  "phoenix","griffin","gryphon","hippogriff","pegasus","unicorn","alicorn",
  "sphinx","lamassu","shedu","simurgh","rukh","roc","thunderbird",
  "werewolf","werebear","weretiger","lycanthrope","shapeshifter","skinwalker",
  "elemental","fire elemental","water elemental","earth elemental","air elemental",
  "golem","construct","automaton","homunculus","iron golem","clay golem",
  "ghost","spirit","poltergeist","haunt","apparition","manifestation",
  // Real animals used fantastically
  "wolf","bear","eagle","lion","tiger","serpent","hawk","raven","crow",
  "horse","steed","mount","war horse","destrier","warhorse","charger",
  "dementor","boggart","hippogriff","thestral","basilisk","phoenix",
  "aragog","acromantula","blast-ended skrewt","manticore","nundu",
  // Descriptors that signal creatures
  "beast","creature","monster","fiend","entity","abomination","horror",
  "predator","prey","pack","herd","swarm","nest","lair","den","burrow",
  "tamed","wild","feral","domesticated","trained","bonded","familiar",
  "legendary beast","mythical creature","rare specimen","dangerous","deadly",
];

// EMOTIONAL ARCHITECTURE
const EMOTION_WORDS = [
  // Trauma & wounds
  "trauma","traumatic","traumatized","wound","wounded","scarred","damaged",
  "broken","shattered","destroyed inside","ruined","hollow","empty inside",
  "past haunts","haunted by","cannot forget","still remembers","nightmare",
  "flashback","triggers","reminded of","carries the weight","burden of",
  // Negative emotions
  "fear","fears","afraid","terrified","petrified","paralyzed with fear",
  "anxiety","anxious","nervous","dread","dreads","apprehensive","worried",
  "grief","grieving","mourning","bereft","devastated","heartbroken","loss",
  "guilt","guilty","blames himself","blames herself","cannot forgive",
  "shame","ashamed","humiliated","embarrassed","degraded","dishonored",
  "regret","regrets","wishes he had","wishes she had","should have",
  "despair","hopeless","helpless","worthless","meaningless","pointless",
  "anger","rage","furious","seething","burning with","consumed by anger",
  "resentment","bitter","holds grudge","cannot forgive","hatred festering",
  "jealousy","jealous","envious","covets","wants what another has",
  "loneliness","lonely","isolated","alone","abandoned","no one understands",
  "depression","depressed","melancholy","sorrow","sad","unhappy","joyless",
  "numbness","numb","feels nothing","detached","dissociated","empty",
  // Internal conflict
  "torn between","divided","conflicted","cannot decide","wrestles with",
  "part of him","part of her","two sides","inner struggle","battle within",
  "questions everything","doubts","uncertainty","searching for meaning",
  "lost","adrift","no purpose","no direction","no sense of self","identity crisis",
  // Positive emotions & growth
  "hope","hopeful","believes in","still has faith","refuses to give up",
  "courage","brave","overcomes fear","faces what frightens","pushes through",
  "love","cares deeply","would die for","protects at all cost","cherishes",
  "pride","proud","accomplishment","worthy","deserving","earned",
  "healing","recovering","learning to","slowly","one day at a time",
  "growth","changed","different now","stronger for it","wiser","matured",
  "acceptance","comes to terms","makes peace with","lets go","moves on",
  "joy","happiness","contentment","peace","belonging","home","found his","found her",
  // Character states
  "emotional state","psychological","mentally","internally","deep down",
  "secretly feels","hidden feelings","never shows","masks with","hides behind",
  "core wound","deepest fear","greatest desire","what drives","motivation",
  "character arc","development","growth","change","transformation",
  // Drinking/substances as emotion signals
  "drinks to forget","uses to cope","addiction","numbness through",
  "drunk","intoxicated","sedated","drugged","escapism","avoidance",
];

// QUESTS & PLOTLINES
const QUEST_WORDS = [
  "quest","mission","task","assignment","job","contract","commission",
  "objective","goal","aim","purpose","target","mark","bounty",
  "journey","adventure","expedition","voyage","pilgrimage","odyssey",
  "main quest","side quest","main story","subplot","story arc","narrative arc",
  "find","retrieve","recover","obtain","acquire","steal","liberate",
  "deliver","escort","protect","defend","guard","shield","safeguard",
  "rescue","save","free","liberate","extract","evacuate","break out",
  "destroy","eliminate","defeat","kill","assassinate","neutralize","remove",
  "prevent","stop","sabotage","undermine","thwart","foil","intercept",
  "investigate","solve","uncover","discover","reveal","expose","prove",
  "gather information","gather intel","recon","scout","spy","infiltrate",
  "negotiate","mediate","broker","arrange","forge","create alliance",
  "build","construct","create","forge","establish","found","develop",
  "plot","scheme","plan","conspiracy","machination","maneuver","stratagem",
  "hook","setup","inciting incident","call to adventure","catalyst",
  "rising action","climax","turning point","resolution","denouement",
  "reward","payment","prize","treasure","knowledge","power","freedom",
  "consequence","result","outcome","fallout","aftermath","repercussion",
  "branching path","choice","decision point","crossroads","turning point",
  "villain's plan","hero's journey","reluctant hero","chosen one",
  "deadline","time limit","race against","before it's too late","urgency",
];

// MYSTERIES
const MYSTERY_WORDS = [
  "mystery","mysterious","enigmatic","puzzling","baffling","inexplicable",
  "secret","hidden","concealed","buried","forgotten","lost","unknown",
  "conspiracy","cover-up","corruption","deception","manipulation","plot",
  "disappearance","missing","vanished","gone without trace","last seen",
  "unsolved","unexplained","no one knows","mystery surrounds","strange",
  "clue","hint","evidence","proof","trace","lead","trail","breadcrumb",
  "the truth is","the real story","what really happened","behind the scenes",
  "hidden identity","true nature","secret past","dark secret","buried truth",
  "who is","what is","why did","how did","where is","when did","which one",
  "suspected","accused","innocent","guilty","frame","set up","scapegoat",
  "ancient secret","forgotten history","suppressed","erased","rewrote history",
  "hidden agenda","ulterior motive","not what they seem","double agent",
  "prophecy","fate","destiny","foretold","written in","stars say","doom",
  "foreshadowing","portent","omen","sign","warning","vision of future",
  "paradox","contradiction","impossible","defies explanation","anomaly",
];

// THEMES & TONE
const THEME_WORDS = [
  // Classic themes
  "theme of","explores","examines","questions","challenges","subverts",
  "hope","hopelessness","despair","redemption","corruption","fall from grace",
  "identity","who am i","sense of self","belonging","outsider","found family",
  "sacrifice","selflessness","giving up","for the greater good","noble death",
  "duty","honor","loyalty","code","principles","morality","ethics","virtue",
  "love","romance","connection","relationship","bond","attachment","devotion",
  "loss","grief","letting go","moving on","acceptance","death","mortality",
  "power","corruption of power","absolute power","temptation","ambition",
  "freedom","oppression","liberation","slavery","control","autonomy","will",
  "war","violence","consequences","cost of conflict","price of victory",
  "justice","injustice","revenge","vengeance","retribution","karma","balance",
  "good vs evil","moral ambiguity","grey morality","not black and white",
  "survival","primal instinct","desperation","what we do to survive",
  "coming of age","growing up","loss of innocence","maturation","adulthood",
  "found family","chosen family","bonds beyond blood","fellowship","brotherhood",
  "redemption arc","seeking forgiveness","making amends","second chance",
  "courage","facing fear","bravery","overcoming","defying odds","perseverance",
  "truth","deception","illusion vs reality","perception","what is real",
  "legacy","what we leave behind","impact","memory","history","future",
  "nature vs nurture","fate vs choice","determinism","free will","destiny",
  // Tone descriptors
  "dark","gritty","brutal","unforgiving","harsh","bleak","nihilistic",
  "hopeful","uplifting","inspiring","triumphant","optimistic","warm",
  "mysterious","cryptic","enigmatic","foreboding","ominous","sinister",
  "epic","grand","sweeping","vast","large scale","world-changing",
  "intimate","personal","character-driven","emotional","heartfelt","touching",
  "humorous","comedic","lighthearted","whimsical","playful","fun",
  "tragic","melancholic","bittersweet","somber","mournful","elegiac",
  "tense","suspenseful","thrilling","action-packed","fast-paced","urgent",
  "philosophical","contemplative","introspective","thoughtful","deep",
];

// WRITING STYLE
const WRITING_WORDS = [
  "narrative voice","point of view","pov","perspective","narrator","unreliable narrator",
  "first person","second person","third person","omniscient","limited","objective",
  "prose style","writing style","narrative style","literary style","tone of voice",
  "pacing","tempo","rhythm","flow","beats","scene structure","chapter structure",
  "description","descriptive","vivid","sparse","minimalist","maximalist","purple prose",
  "dialogue","monologue","inner monologue","stream of consciousness","soliloquy",
  "show don't tell","subtext","implication","suggestion","indirect","subtle",
  "metaphor","simile","analogy","imagery","symbolism","motif","leitmotif",
  "paragraph length","sentence structure","syntax","diction","word choice","vocabulary",
  "violence level","graphic","brutal","sanitized","implied","fade to black",
  "romance level","explicit","tasteful","suggested","emotional","physical",
  "humor style","dry","sarcastic","comedic","ironic","satirical","absurdist",
  "formatting rules","capitalization","punctuation","italics","bold","emphasis",
  "always write","never write","avoid","use","include","exclude","prefer",
  "write in","respond as","narrate","describe","portray","convey","express",
  "literary","genre","realistic","fantastical","grounded","elevated","lyrical",
];

// SPECIES & RACES
const SPECIES_WORDS = [
  "race","species","kind","type","people","folk","kin","breed","bloodline",
  "human","humankind","mankind","mortal","mundane","baseline","normal",
  "elf","elves","elven","elvish","fae","faerie folk","fair folk","immortal",
  "dwarf","dwarves","dwarven","dwarvish","mountain folk","stone people",
  "orc","orcish","orc clan","half-orc","savage","warrior race",
  "halfling","hobbit","gnome","gnomish","small folk","little people",
  "troll","giant","titan","colossus","large folk","big folk",
  "dragon","dragonborn","draconic","dragon kin","half-dragon","scaled",
  "tiefling","demonic heritage","infernal blood","cursed lineage",
  "angel","aasimar","divine blood","celestial heritage","holy lineage",
  "undead","revenant","dhampir","vampire lord","lich","death touched",
  "shapeshifter","shifter","lycanthrope","changeling","doppelganger",
  "construct","golem","automaton","warforged","mechanical","artificial",
  "elemental","genasi","touched by","infused with","born of","spirit folk",
  "half-elf","half-orc","half-dragon","mixed heritage","hybrid","crossbreed",
  "pureblood","pureblooded","noble blood","ancient lineage","cursed blood",
  "muggle","muggleborn","half-blood","pureblood","squib","witch","wizard",
  "biology","physiology","anatomy","lifespan","aging","immortality","mortality",
  "ability","racial trait","species ability","innate power","natural talent",
  "culture","tradition","custom","way of life","society","community",
  "evolution","mutation","adaptation","subspecies","variant","bloodline",
];

// CULTURES & SOCIETY
const CULTURE_WORDS = [
  "culture","cultural","civilization","society","social","community","people",
  "tradition","custom","practice","ritual","ceremony","festival","celebration",
  "holiday","feast","feast day","holy day","anniversary","commemoration",
  "language","tongue","dialect","accent","script","writing system","rune",
  "fashion","clothing","dress","attire","garment","costume","uniform","style",
  "food","cuisine","dish","meal","feast","banquet","drink","beverage","brew",
  "art","painting","sculpture","carving","tapestry","mosaic","mural","craft",
  "music","song","hymn","chant","instrument","performance","dance","theater",
  "architecture","building","structure","monument","landmark","style of building",
  "social class","caste","hierarchy","nobility","commoner","peasant","slave",
  "family","household","clan","tribe","kinship","marriage","betrothal","divorce",
  "education","schooling","apprenticeship","training","learning","knowledge",
  "entertainment","sport","game","competition","tournament","gladiatorial",
  "taboo","forbidden","sacred","holy","profane","polluted","unclean","pure",
  "value","belief","worldview","philosophy","ideology","moral code","ethics",
  "honor","shame","face","reputation","standing","respect","disrespect",
  "law","custom","rule","norm","expectation","obligation","duty","right",
  "gender","role","expectation","position","status","power within society",
  "coming of age","rite of passage","initiation","ceremony","test","trial",
];

// ECONOMY
const ECONOMY_WORDS = [
  "gold","silver","bronze","copper","platinum","coin","currency","money","wealth",
  "galleon","sickle","knut","septim","drake","doubloon","ducat","florin","mark",
  "trade","trading","commerce","merchant","trader","vendor","seller","buyer",
  "market","bazaar","fair","auction","exchange","barter","deal","transaction",
  "price","cost","value","worth","expensive","cheap","affordable","priceless",
  "tax","tribute","tithe","levy","tariff","toll","duty","customs","import tax",
  "wealth","rich","wealthy","affluent","poor","poverty","destitute","beggar",
  "bank","banking","money lender","loan","debt","interest","credit","ledger",
  "industry","production","manufacturing","crafting","mining","farming","fishing",
  "resource","material","raw material","ore","timber","grain","livestock","crop",
  "supply","demand","shortage","surplus","monopoly","competition","market force",
  "trade route","supply line","caravan","convoy","merchant vessel","trade ship",
  "black market","underground economy","illegal trade","smuggling","contraband",
  "guild fee","membership","dues","licensing","regulation","control",
  "investment","profit","loss","return","dividend","share","stake","ownership",
  "economic","financial","fiscal","monetary","commercial","mercantile",
];

// SESSION NOTES
const SESSION_WORDS = [
  "session","this session","last session","today's session","we played",
  "player decided","player chose","player said","we agreed","in game",
  "out of game","ooc","in character","ic","as a player","as the dm","as the gm",
  "what happened","during the game","in the session","while playing",
  "player action","player reaction","player choice","player consequence",
  "the party","the group","everyone","we all","the players","my character",
  "dm note","gm note","note for next session","remember to","don't forget",
  "recap","summary","log","record","account","report of session",
  "loot obtained","items found","treasure gained","experience earned",
  "level up","advancement","milestone","achievement","unlocked",
  "combat result","battle outcome","who won","who lost","casualties",
  "npc interaction","conversation with","talked to","met with","encountered",
  "new information","learned that","discovered that","found out","revealed",
  "consequence of","result of","because we","since we","after we",
  "unresolved","still ongoing","to be continued","next session","future hook",
];

// TIMELINE/CONTINUITY
const CONTINUITY_WORDS = [
  "timeline","chronological","in order","sequence of events","what happened when",
  "continuity","canon","established","confirmed","official","approved",
  "flashback","memory","remembers","recalled","in the past","used to",
  "future","will","shall","going to","plans to","intends to","destined to",
  "alternate timeline","what if","parallel","branching","diverge","split",
  "retcon","changed","revised","updated","corrected","retconned",
  "before","after","during","while","simultaneously","at the same time",
  "years before","months before","days before","hours before","moments before",
  "years after","long after","shortly after","immediately after","following",
  "era","age","epoch","period","time of","reign of","during the",
  "first","second","third","fourth","last","final","penultimate",
  "beginning","middle","end","start","finish","conclusion","epilogue",
  "chapter","book","volume","arc","part","phase","stage",
  "date","year","month","week","day","hour","moment","instant",
];

// INFORMATION ARCHITECTURE
const INFO_WORDS = [
  "fact","true","truth","false","lie","untrue","fabrication","fiction",
  "rumor","gossip","hearsay","unconfirmed","alleged","supposedly","reportedly",
  "known","unknown","secret","classified","confidential","restricted","hidden",
  "revealed","exposed","disclosed","leaked","uncovered","discovered",
  "player knows","character knows","audience knows","reader knows","only x knows",
  "hidden from","concealed from","lied to","deceived","misled","tricked",
  "half-truth","misleading","technically true","out of context","distorted",
  "reliable source","unreliable","trustworthy","untrustworthy","questionable",
  "what x believes","thinks","assumes","suspects","doesn't know","unaware",
  "dramatic irony","the audience knows","the reader knows but character doesn't",
  "contradiction","inconsistency","plot hole","discrepancy","conflict",
  "verify","confirm","deny","prove","disprove","evidence for","evidence against",
];

// META INFORMATION
const META_WORDS = [
  "note:","author note","todo","to do","to-do","reminder","don't forget",
  "idea","concept","brainstorm","thinking about","considering","maybe",
  "draft","rough","sketch","outline","placeholder","temp","wip","work in progress",
  "future","planned","upcoming","eventually","someday","later","will add",
  "cut","removed","deleted","scrapped","retired","unused","rejected","dropped",
  "inspiration","inspired by","based on","reference","homage","similar to",
  "research","source","citation","from","according to","reference material",
  "revision","update","change","modify","edit","rework","rewrite","overhaul",
  "important note","remember","key detail","crucial","essential","don't miss",
  "canon status","is this canon","non-canon","headcanon","speculation","theory",
  "author intent","thematic purpose","narrative function","why this exists",
];

// BRANCHING CANON
const CANON_WORDS = [
  "alternate","alternative","what if","hypothetical","scenario","possibility",
  "canon","official","approved","confirmed","established","definitive",
  "non-canon","unofficial","rejected","alternate version","variant",
  "headcanon","fanon","interpretation","reading","perspective","take",
  "timeline a","timeline b","timeline c","branch","split","fork","diverge",
  "parallel universe","alternate reality","mirror universe","dark timeline",
  "bad ending","good ending","neutral ending","true ending","secret ending",
  "route","path","playthrough","run","choice","option","branch","decision",
  "dream","nightmare","vision","hallucination","illusion","false reality",
  "simulation","virtual","constructed","artificial","fake","not real",
  "retcon","revision","ret-con","changed retroactively","rewritten history",
  "flashback","memory","how it really happened","the true account",
  "in another life","could have been","might have been","should have been",
];

// SCIENCE & TECHNOLOGY
const SCIFI_WORDS = [
  "technology","technological","tech","advanced","futuristic","modern","primitive",
  "science","scientific","research","experiment","laboratory","hypothesis","theory",
  "machine","device","apparatus","mechanism","contraption","invention","gadget",
  "engine","motor","generator","power source","fuel","energy","reactor",
  "computer","artificial intelligence","ai","robot","android","cyborg","drone",
  "weapon","arms","armament","firearm","explosive","bomb","missile","rocket",
  "transport","vehicle","ship","aircraft","spacecraft","submarine","vessel",
  "medicine","medical","healing","surgery","cure","disease","treatment","drug",
  "communication","signal","frequency","transmission","broadcast","network",
  "engineering","construction","architecture","infrastructure","building",
  "biotechnology","genetic","dna","mutation","enhancement","modification",
  "space","planet","star","galaxy","orbit","gravity","vacuum","cosmos",
  "industrial","factory","production","manufacturing","mass production","assembly",
  "energy","power","electricity","nuclear","solar","chemical","mechanical",
  "discovery","invention","patent","innovation","breakthrough","advancement",
];

// PC (Player Character)
const PC_WORDS = [
  "player character","my character","pc:","protagonist is","i am playing as",
  "i am","my name is","my character is","i have","i can","i know","i feel",
  "valefor","the player","player's character","main character is me",
  "player ability","player stat","player inventory","player skill",
  "my backstory","my history","my past","my goal","my motivation","my fear",
  "my strength","my weakness","my secret","my power","my ability",
  "current hp","current health","current status","my condition","my state",
  "i carry","i wear","i wield","i possess","in my inventory","on my person",
  "i believe","i think","i feel","my opinion","my perspective","from my view",
];

// RULES
const RULE_WORDS = [
  "do not","don't","must not","mustn't","never ","always ","must ",
  "should ","shouldn't","cannot","can't","will not","won't","shall not",
  "forbidden","prohibited","banned","illegal","against the rules","not allowed",
  "rule:","law:","decree:","important:","remember:","note:","warning:",
  "constraint:","restriction:","guideline:","principle:","commandment:",
  "it is forbidden","it is required","it is expected","it is mandatory",
  "under no circumstances","at all times","without exception","no matter what",
  "in every case","always remember","never forget","keep in mind",
  "the law states","according to law","by decree","by order","by rule",
  "game mechanic","game rule","how combat works","how magic works",
  "limitation","restriction","constraint","bounded by","limited to",
  "penalty","consequence","punishment","enforcement","violation",
];

// SPECIAL: YEAR/TIME REGEX
const YEAR_RE = /\b(year \d+|\d{3,4}\s*(?:ad|bc|ce|bce)?|in \d{4}|\d+th century|\d+st century|\d+nd century|\d+rd century|in the \d+s)\b/i;
const TIME_RE = /\b(morning|afternoon|evening|night|dawn|dusk|midnight|noon|sunrise|sunset|daybreak|nightfall|twilight|witching hour|dead of night)\b/i;
const PROPER_NAME_RE = /\b([A-Z][a-zÀ-ÿ]{1,25}(?:\s[A-Z][a-zÀ-ÿ]{1,25}){1,2})\b/g;

// ─── UTILITY FUNCTIONS ────────────────────────────────────────────────────────

function containsAny(text: string, list: string[]): boolean {
  const lower = text.toLowerCase();
  return list.some((item) => lower.includes(item));
}

function countMatches(text: string, list: string[]): number {
  const lower = text.toLowerCase();
  return list.reduce((count, item) => count + (lower.includes(item) ? 1 : 0), 0);
}

function isNoise(word: string): boolean {
  return NOISE_WORDS.has(word.toLowerCase().trim());
}

function looksLikePlace(word: string): boolean {
  if (word.length < 3) return false;
  const lower = word.toLowerCase();
  if (NON_LOCATION_WORDS.has(lower)) return false;
  if (isNoise(word)) return false;
  if (LOC_SUFFIXES.some(s => lower.endsWith(s))) return true;
  if (KNOWN_LOCATIONS.has(lower)) return true;
  return false;
}

// ─── SENTENCE CLASSIFIER ─────────────────────────────────────────────────────
// Scores each category and picks the highest — much better than first-match

function classifySentence(text: string): StoryCategory {
  const lower = text.toLowerCase();

  const scores: Partial<Record<StoryCategory, number>> = {};

  function score(cat: StoryCategory, words: string[], weight = 1) {
    const matches = countMatches(lower, words);
    if (matches > 0) scores[cat] = (scores[cat] ?? 0) + matches * weight;
  }

  // High-confidence categories (weight 3)
  score("rules", RULE_WORDS, 3);
  score("player-character", PC_WORDS, 3);
  score("magic-supernatural", MAGIC_WORDS, 2);
  score("relationships", REL_VERBS, 2);

  // Medium-confidence (weight 2)
  score("timeline-continuity", TIMELINE_VERBS, 2);
  score("emotional-architecture", EMOTION_WORDS, 2);
  score("quests-plotlines", QUEST_WORDS, 2);
  score("mysteries", MYSTERY_WORDS, 2);
  score("conflict-combat", ["combat","battle","fight","duel","war","attack","defend","strategy","military","siege","assault","skirmish","brawl","clash","engagement","firefight","ambush","raid","sortie","charge","retreat","flank","outmaneuver","tactical","strategic","formation"], 2);
  score("items-equipment", ITEM_WORDS, 2);
  score("creatures-wildlife", CREATURE_WORDS, 2);
  score("lore-mythology", LORE_WORDS, 2);

  // Normal weight (1)
  score("history", HISTORY_WORDS, 1);
  score("world-overview", WORLD_WORDS, 1);
  score("geography", ["continent","region","geography","terrain","climate","landscape","topography","biome","map","border","north","south","east","west","northern","southern","eastern","western","highland","lowland","coastal","inland","landlocked","mountainous","volcanic","tectonic","seismic"], 1);
  score("political-systems", POLITICAL_WORDS, 1);
  score("organizations", ORG_WORDS, 1);
  score("factions", FACTION_WORDS, 1);
  score("economy", ECONOMY_WORDS, 1);
  score("cultures-society", CULTURE_WORDS, 1);
  score("species-races", SPECIES_WORDS, 1);
  score("themes-tone", THEME_WORDS, 1);
  score("writing-style", WRITING_WORDS, 1);
  score("session-notes", SESSION_WORDS, 1);
  score("meta-information", META_WORDS, 1);
  score("branching-canon", CANON_WORDS, 1);
  score("information-architecture", INFO_WORDS, 1);
  score("science-technology", SCIFI_WORDS, 1);
  score("timeline-continuity", CONTINUITY_WORDS, 1);
  score("emotional-architecture", EMOTION_WORDS, 1);

  // Location detection
  score("locations", LOC_SUFFIXES, 1);
  score("locations", PLACE_VERBS, 1);
  if (YEAR_RE.test(lower) || TIME_RE.test(lower)) {
    scores["timeline-continuity"] = (scores["timeline-continuity"] ?? 0) + 3;
  }

  // Characters boost from proper names
  const names = [...text.matchAll(PROPER_NAME_RE)];
  if (names.length >= 1) {
    scores["characters"] = (scores["characters"] ?? 0) + names.length;
  }

  // Find highest scoring category
  let best: StoryCategory = "lore-mythology";
  let bestScore = 0;
  for (const [cat, s] of Object.entries(scores) as [StoryCategory, number][]) {
    if (s > bestScore) { bestScore = s; best = cat; }
  }

  return best;
}

// ─── ENTITY EXTRACTOR ─────────────────────────────────────────────────────────

function extractFromSentence(sentence: string): Suggestion[] {
  const results: Suggestion[] = [];
  const lower = sentence.toLowerCase();
  const seen = new Set<string>();

  function add(text: string, category: StoryCategory) {
    const t = text.trim();
    const key = `${category}::${t.toLowerCase()}`;
    if (t.length < 2 || isNoise(t) || seen.has(key)) return;
    seen.add(key);
    results.push({ text: t, category });
  }

  // 1. Primary classification (scored)
  add(sentence, classifySentence(sentence));

  // 2. Known characters (lowercase single names)
  for (const word of lower.split(/\s+/)) {
    const clean = word.replace(/[^a-zÀ-ÿ]/g, "");
    if (KNOWN_CHARACTERS.has(clean) && clean.length > 2) {
      add(clean.charAt(0).toUpperCase() + clean.slice(1), "characters");
    }
  }

  // 3. Capitalized proper names → characters (if not loc/org/item)
  for (const [, name] of sentence.matchAll(PROPER_NAME_RE)) {
    const nl = name.toLowerCase();
    const isLoc = LOC_SUFFIXES.some(s => nl.endsWith(s));
    const isOrg = ["order","ministry","council","alliance","guild","league","union","brotherhood","sisterhood","syndicate","corporation","organization","association","institute","academy","church"].some(s => nl.endsWith(s));
    const isItem = ITEM_WORDS.some(s => nl.endsWith(s));
    if (!isLoc && !isOrg && !isItem && !isNoise(name)) {
      add(name, "characters");
    }
  }

  // 4. Known locations
  for (const loc of KNOWN_LOCATIONS) {
    if (lower.includes(loc)) {
      add(loc.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), "locations");
    }
  }

  // 5. Strong location context ("arrived at X", "lives in X" etc.)
  for (const ctx of LOC_CONTEXT_WORDS) {
    const idx = lower.indexOf(ctx);
    if (idx !== -1) {
      const after = lower.slice(idx + ctx.length).trim().split(/\s+/);
      const word = after[0]?.replace(/[^a-zÀ-ÿ]/g, "");
      if (word && word.length > 2 && !isNoise(word) && !KNOWN_CHARACTERS.has(word)) {
        const second = after[1]?.replace(/[^a-zÀ-ÿ]/g, "");
        const place = second && second.length > 2 && !isNoise(second) && looksLikePlace(second)
          ? `${word.charAt(0).toUpperCase() + word.slice(1)} ${second.charAt(0).toUpperCase() + second.slice(1)}`
          : word.charAt(0).toUpperCase() + word.slice(1);
        add(place, "locations");
      }
    }
  }

  // 6. Soft prepositions ("at X", "in X") — only if word looks like a place
  for (const prep of ["at ","in ","near ","inside ","beneath ","above ","beyond ","within "]) {
    const idx = lower.indexOf(prep);
    if (idx !== -1) {
      const after = lower.slice(idx + prep.length).trim().split(/\s+/);
      const word = after[0]?.replace(/[^a-zÀ-ÿ]/g, "");
      if (word && word.length > 2 && !isNoise(word) && !KNOWN_CHARACTERS.has(word) && !NON_LOCATION_WORDS.has(word) && looksLikePlace(word)) {
        const second = after[1]?.replace(/[^a-zÀ-ÿ]/g, "");
        const place = second && second.length > 2 && looksLikePlace(second) && !NON_LOCATION_WORDS.has(second)
          ? `${word.charAt(0).toUpperCase() + word.slice(1)} ${second.charAt(0).toUpperCase() + second.slice(1)}`
          : word.charAt(0).toUpperCase() + word.slice(1);
        add(place, "locations");
      }
    }
  }

  // 7. Location suffixes ("Darkwood Forest", "Iron Keep" etc.)
  const wordArr = lower.split(/\s+/);
  for (let i = 1; i < wordArr.length; i++) {
    const w = wordArr[i].replace(/[^a-z]/g, "");
    if (LOC_SUFFIXES.includes(w)) {
      const prev = wordArr[i-1].replace(/[^a-z]/g, "");
      if (prev.length > 1 && !isNoise(prev) && !NON_LOCATION_WORDS.has(prev)) {
        add(`${prev.charAt(0).toUpperCase() + prev.slice(1)} ${w.charAt(0).toUpperCase() + w.slice(1)}`, "locations");
      }
    }
  }

  // 8. Known artifacts
  for (const art of KNOWN_ARTIFACTS) {
    if (lower.includes(art)) {
      add(art.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "), "items-equipment");
    }
  }

  // 9. Item suffixes ("Iron Sword", "Ancient Tome" etc.)
  const ITEM_SUFFIXES = ["sword","blade","dagger","axe","bow","staff","wand","rod","orb","crystal","ring","amulet","pendant","crown","helmet","shield","armor","cloak","tome","scroll","key","talisman","potion","elixir","mirror","compass","locket","relic","artifact","spear","lance","hammer","mace","vial","flask","scepter","gauntlet","chalice","goblet"];
  for (let i = 1; i < wordArr.length; i++) {
    const w = wordArr[i].replace(/[^a-z]/g, "");
    if (ITEM_SUFFIXES.includes(w)) {
      const prev = wordArr[i-1].replace(/[^a-z]/g, "");
      if (prev.length > 1 && !isNoise(prev)) {
        add(`${prev.charAt(0).toUpperCase() + prev.slice(1)} ${w.charAt(0).toUpperCase() + w.slice(1)}`, "items-equipment");
      }
    }
  }

  // 10. Organization suffixes
  const ORG_SUFFIXES = ["order","ministry","council","brotherhood","sisterhood","alliance","league","union","guild","syndicate","cult","parliament","senate","assembly","bureau","department","division","corps","regiment","battalion","company","agency","foundation","club","lodge","tribunal"];
  for (let i = 1; i < wordArr.length; i++) {
    const w = wordArr[i].replace(/[^a-z]/g, "");
    if (ORG_SUFFIXES.includes(w)) {
      const prev = wordArr[i-1].replace(/[^a-z]/g, "");
      if (prev.length > 2 && !isNoise(prev) && prev !== "the") {
        add(`${prev.charAt(0).toUpperCase() + prev.slice(1)} ${w.charAt(0).toUpperCase() + w.slice(1)}`, "organizations");
      }
    }
  }

  // 11. Multi-category triggers — add sentence to additional categories if strongly indicated
  const additionalTriggers: Array<{ words: string[]; category: StoryCategory; threshold: number }> = [
    { words: TIMELINE_VERBS, category: "timeline-continuity", threshold: 1 },
    { words: REL_VERBS, category: "relationships", threshold: 1 },
    { words: MAGIC_WORDS, category: "magic-supernatural", threshold: 2 },
    { words: EMOTION_WORDS, category: "emotional-architecture", threshold: 2 },
    { words: CREATURE_WORDS, category: "creatures-wildlife", threshold: 1 },
    { words: QUEST_WORDS, category: "quests-plotlines", threshold: 2 },
    { words: MYSTERY_WORDS, category: "mysteries", threshold: 2 },
    { words: ITEM_WORDS, category: "items-equipment", threshold: 2 },
    { words: POLITICAL_WORDS, category: "political-systems", threshold: 2 },
    { words: LORE_WORDS, category: "lore-mythology", threshold: 2 },
    { words: SESSION_WORDS, category: "session-notes", threshold: 1 },
    { words: RULE_WORDS, category: "rules", threshold: 1 },
    { words: THEME_WORDS, category: "themes-tone", threshold: 3 },
    { words: HISTORY_WORDS, category: "history", threshold: 2 },
    { words: FACTION_WORDS, category: "factions", threshold: 2 },
    { words: ECONOMY_WORDS, category: "economy", threshold: 2 },
    { words: CULTURE_WORDS, category: "cultures-society", threshold: 2 },
    { words: SPECIES_WORDS, category: "species-races", threshold: 2 },
  ];

  if (YEAR_RE.test(lower) || TIME_RE.test(lower)) {
    add(sentence, "timeline-continuity");
  }

  for (const { words, category, threshold } of additionalTriggers) {
    if (countMatches(lower, words) >= threshold && classifySentence(sentence) !== category) {
      add(sentence, category);
    }
  }

  return results;
}

function analyzeAndExpand(input: string): Suggestion[] {
  const sentences = input
    .split(/\n|(?<=[.!?])\s+/)
    .map(p => p.trim())
    .filter(p => p.length > 4);

  const all: Suggestion[] = [];
  const seen = new Set<string>();

  for (const sentence of sentences) {
    for (const item of extractFromSentence(sentence)) {
      const key = `${item.category}::${item.text.toLowerCase()}`;
      if (!seen.has(key)) { seen.add(key); all.push(item); }
    }
  }

  return all;
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function InboxPage() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [imported, setImported] = useState(false);
  const [contradiction, setContradiction] = useState<ContradictionState | null>(null);
  const [showSavePrompt, setShowSavePrompt] = useState(false);
  const [copiedSave, setCopiedSave] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [aiClassifying, setAiClassifying] = useState(false);
  const [reviewResults, setReviewResults] = useState<Array<{
    text: string; originalCategory: string; suggestedCategory: string; reason: string; changed: boolean; accepted: boolean;
  }>>([]);
  const [showReview, setShowReview] = useState(false);
  const [dynamicSavePrompt, setDynamicSavePrompt] = useState("");
  const [generatingSavePrompt, setGeneratingSavePrompt] = useState(false);

  function analyzeInput() { setSuggestions(analyzeAndExpand(input)); setImported(false); }

  function updateCategory(index: number, category: StoryCategory) {
    setSuggestions(prev => prev.map((item, i) => i === index ? { ...item, category } : item));
  }
  function removeSuggestion(index: number) {
    setSuggestions(prev => prev.filter((_, i) => i !== index));
  }

  function processNext(queue: Suggestion[], archive: ArchiveData) {
    if (queue.length === 0) {
      saveArchive(regenerateMasterPrompt(archive));
      setSuggestions([]); setInput(""); setImported(true); setContradiction(null); return;
    }
    const [current, ...rest] = queue;
    const result = detectContradiction(archive, current.text, current.category);
    if (result.hasContradiction && result.existingEntry) {
      setContradiction({ existingEntry: result.existingEntry, newText: current.text, category: current.category, remainingQueue: rest, currentArchive: archive });
      return;
    }
    processNext(rest, addEntry(archive, current.text, current.category));
  }

  function importSuggestions() { processNext(suggestions, loadArchive()); }
  function resolveKeepBoth() { if (!contradiction) return; processNext(contradiction.remainingQueue, addEntry(contradiction.currentArchive, contradiction.newText, contradiction.category)); }
  function resolveReplace() { if (!contradiction) return; processNext(contradiction.remainingQueue, replaceEntry(contradiction.currentArchive, contradiction.existingEntry.id, contradiction.newText, contradiction.category)); }
  function resolveSkip() { if (!contradiction) return; processNext(contradiction.remainingQueue, contradiction.currentArchive); }

  function handleCopySavePrompt() {
    navigator.clipboard.writeText(DEFAULT_SAVE_PROMPT);
    setCopiedSave(true);
    setTimeout(() => setCopiedSave(false), 2000);
  }

  function handleExportSavePrompt() {
    const blob = new Blob([DEFAULT_SAVE_PROMPT], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "session_save_extraction_prompt.txt";
    a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--va-bg)", color: "var(--va-text)", padding: "2rem" }}>

      {/* Contradiction Modal */}
      {contradiction && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid #92400e", borderRadius: "0.75rem", padding: "2rem", maxWidth: "32rem", width: "100%" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#fbbf24", marginBottom: "0.5rem" }}>⚠️ Contradiction Detected</h2>
            <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", marginBottom: "1.5rem" }}>New information may conflict with something already in your Vault.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.25rem" }}>EXISTING</p>
                <p style={{ color: "#fca5a5", fontSize: "0.875rem" }}>{contradiction.existingEntry.text}</p>
              </div>
              <div style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem" }}>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginBottom: "0.25rem" }}>NEW</p>
                <p style={{ color: "#86efac", fontSize: "0.875rem" }}>{contradiction.newText}</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button onClick={resolveKeepBoth} style={{ background: "var(--va-accent)", color: "white", padding: "0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Keep Both</button>
              <button onClick={resolveReplace} style={{ background: "#b45309", color: "white", padding: "0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Replace Existing</button>
              <button onClick={resolveSkip} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>Skip</button>
            </div>
          </div>
        </div>
      )}

      {/* Save Prompt Modal */}
      {showSavePrompt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}>
          <div style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", borderRadius: "0.75rem", padding: "2rem", maxWidth: "56rem", width: "100%", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
              <div>
                <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "var(--va-accent)" }}>💾 Session Save Prompt</h2>
                <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)", marginTop: "0.25rem" }}>Send this to your AI to extract everything from your session.</p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                {hasGeminiKey() && (
                  <button onClick={async () => {
                    setGeneratingSavePrompt(true);
                    const archive = loadArchive();
                    const withPrompt = regenerateMasterPrompt(archive);
                    const dynamic = await geminiGenerateSavePrompt(withPrompt.masterPrompt);
                    if (dynamic) setDynamicSavePrompt(dynamic);
                    setGeneratingSavePrompt(false);
                  }} disabled={generatingSavePrompt}
                  style={{ background: "#7c3aed", color: "white", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", opacity: generatingSavePrompt ? 0.6 : 1 }}>
                    {generatingSavePrompt ? "✨ Generating..." : "✨ AI Personalize"}
                  </button>
                )}
                {dynamicSavePrompt && (
                  <button onClick={() => setDynamicSavePrompt("")}
                    style={{ background: "var(--va-border)", color: "var(--va-text-muted)", padding: "0.375rem 0.75rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.75rem" }}>
                    Use Default
                  </button>
                )}
                <button onClick={() => { navigator.clipboard.writeText(dynamicSavePrompt || DEFAULT_SAVE_PROMPT); setCopiedSave(true); setTimeout(() => setCopiedSave(false), 2000); }} style={{ background: "var(--va-accent)", color: "white", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>{copiedSave ? "✓ Copied!" : "📋 Copy"}</button>
                <button onClick={() => { const blob = new Blob([dynamicSavePrompt || DEFAULT_SAVE_PROMPT], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "session_save_prompt.txt"; a.click(); URL.revokeObjectURL(url); }} style={{ background: "var(--va-border)", color: "var(--va-text)", padding: "0.375rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontSize: "0.875rem" }}>📄 Export TXT</button>
                <button onClick={() => { setShowSavePrompt(false); setDynamicSavePrompt(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--va-text-muted)", fontSize: "0.875rem", padding: "0.375rem 0.75rem" }}>Close</button>
              </div>
            </div>
            {dynamicSavePrompt && (
              <p style={{ fontSize: "0.75rem", color: "#c4b5fd", marginBottom: "0.5rem" }}>✨ AI-personalized for your archive — references your specific characters and story</p>
            )}
            <textarea value={dynamicSavePrompt || DEFAULT_SAVE_PROMPT} onChange={(e) => dynamicSavePrompt ? setDynamicSavePrompt(e.target.value) : null} readOnly={!dynamicSavePrompt} style={{ flex: 1, minHeight: "400px", background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", outline: "none", resize: "none", fontSize: "0.8rem", fontFamily: "monospace", color: "var(--va-text)", lineHeight: "1.6" }} />
          </div>
        </div>
      )}

      <Link href="/dashboard" style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", display: "block", marginBottom: "1.5rem" }}>← Home</Link>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "3rem", fontWeight: "bold", marginBottom: "0.5rem" }}>📥 Inbox</h1>
          <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem" }}>Paste anything. Val Archives automatically splits information across all relevant categories.</p>
        </div>
        <button onClick={() => setShowSavePrompt(true)}
          style={{ background: "var(--va-surface)", border: "1px solid var(--va-accent)", color: "var(--va-accent)", padding: "0.75rem 1.25rem", borderRadius: "0.75rem", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem", flexShrink: 0 }}>
          💾 Save Prompt
        </button>
      </div>

      <textarea value={input} onChange={(e) => { setInput(e.target.value); setImported(false); }}
        placeholder={`Paste anything here. Examples:\n\n"Aldric Stormborn, the last sorcerer of the Ember Order, arrived at the ruined fortress of Ashengard at dawn. He carried the Shard of Eternity, an ancient artifact capable of sealing the rift between worlds. The demon lord Malachar had been hunting him since the fall of the Silver Kingdom three centuries ago."`}
        style={{ width: "100%", height: "14rem", background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.75rem", padding: "1rem", outline: "none", resize: "vertical", fontSize: "0.875rem", color: "var(--va-text)", boxSizing: "border-box", lineHeight: "1.6" }} />

      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <button onClick={async () => {
          if (!input.trim()) return;
          if (hasGeminiKey()) {
            // AI-first classification
            setAiClassifying(true);
            setSuggestions([]);
            const ALL_CATS = Object.values(CATEGORY_LABELS).length > 0
              ? Object.keys(CATEGORY_LABELS)
              : ["characters","relationships","locations","history","lore-mythology","magic-supernatural","science-technology","political-systems","organizations","economy","cultures-society","species-races","factions","mysteries","quests-plotlines","timeline-continuity","conflict-combat","items-equipment","creatures-wildlife","themes-tone","writing-style","session-notes","meta-information","branching-canon","emotional-architecture","information-architecture","rules","player-character","custom","world-overview","geography"];
            const aiResults = await geminiClassifyText(input, ALL_CATS);
            if (aiResults.length > 0) {
              setSuggestions(aiResults as Suggestion[]);
              setAiClassifying(false);
              return;
            }
            setAiClassifying(false);
          }
          // Fallback to keyword classifier
          analyzeInput();
        }} disabled={!input.trim() || aiClassifying}
        style={{ background: "var(--va-accent)", color: "white", padding: "0.5rem 1.5rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", opacity: (!input.trim() || aiClassifying) ? 0.4 : 1 }}>
          {aiClassifying ? "✨ AI Classifying..." : hasGeminiKey() ? "✨ Analyze with AI" : "Analyze"}
        </button>
        <button disabled={!suggestions.length} onClick={importSuggestions} style={{ background: "#16a34a", color: "white", padding: "0.5rem 1.5rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", opacity: !suggestions.length ? 0.4 : 1 }}>Import All into Vault</button>
        {suggestions.length > 0 && hasGeminiKey() && (
          <button onClick={async () => {
            setReviewing(true); setShowReview(false);
            const archive = loadArchive();
            const withPrompt = regenerateMasterPrompt(archive);
            const results = await geminiSmartCategoryReview(
              suggestions, ALL_CATEGORIES, withPrompt.masterPrompt
            );
            setReviewResults(results.map(r => ({ ...r, accepted: r.changed })));
            setShowReview(true); setReviewing(false);
          }} disabled={reviewing} style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1.5rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", opacity: reviewing ? 0.6 : 1 }}>
            {reviewing ? "✨ Reviewing..." : "✨ AI Smart Review"}
          </button>
        )}
      </div>

      {imported && (
        <div style={{ marginTop: "1rem", padding: "0.75rem 1rem", background: "rgba(20,83,45,0.3)", border: "1px solid #15803d", borderRadius: "0.375rem", color: "#4ade80", fontSize: "0.875rem" }}>
          ✓ Imported into Vault. Master Prompt updated automatically.
        </div>
      )}

      {/* AI Smart Review Panel */}
      {showReview && reviewResults.length > 0 && (
        <div style={{ marginTop: "1.5rem", background: "var(--va-surface)", border: "1px solid #7c3aed", borderRadius: "0.75rem", padding: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <div>
              <h3 style={{ fontWeight: "bold", color: "#c4b5fd", marginBottom: "0.25rem" }}>✨ AI Smart Review</h3>
              <p style={{ fontSize: "0.75rem", color: "var(--va-text-muted)" }}>
                {reviewResults.filter(r => r.changed).length} changes suggested · Accept or reject each one
              </p>
            </div>
            <button
              onClick={() => {
                // Apply accepted changes to suggestions
                const updated = suggestions.map(s => {
                  const review = reviewResults.find(r => r.text === s.text);
                  if (review && review.changed && review.accepted) {
                    return { ...s, category: review.suggestedCategory as typeof s.category };
                  }
                  return s;
                });
                setSuggestions(updated);
                setShowReview(false);
                setReviewResults([]);
              }}
              style={{ background: "#7c3aed", color: "white", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "none", cursor: "pointer", fontWeight: "600", fontSize: "0.875rem" }}>
              Apply Accepted
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {reviewResults.filter(r => r.changed).map((result, i) => (
              <div key={i} style={{ background: "var(--va-bg)", border: `1px solid ${result.accepted ? "#7c3aed" : "var(--va-border)"}`, borderRadius: "0.5rem", padding: "0.75rem" }}>
                <p style={{ fontSize: "0.8rem", color: "var(--va-text)", marginBottom: "0.375rem" }}>{result.text}</p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)", textDecoration: "line-through" }}>{result.originalCategory}</span>
                  <span style={{ fontSize: "0.7rem", color: "#7c3aed" }}>→ {result.suggestedCategory}</span>
                  {result.reason && <span style={{ fontSize: "0.7rem", color: "var(--va-text-muted)" }}>({result.reason})</span>}
                  <button
                    onClick={() => setReviewResults(prev => prev.map((r, idx) => idx === reviewResults.indexOf(result) ? { ...r, accepted: !r.accepted } : r))}
                    style={{ marginLeft: "auto", background: result.accepted ? "#7c3aed" : "var(--va-border)", color: result.accepted ? "white" : "var(--va-text-muted)", padding: "0.2rem 0.625rem", borderRadius: "0.25rem", border: "none", cursor: "pointer", fontSize: "0.75rem", fontWeight: "600" }}>
                    {result.accepted ? "✓ Accept" : "✗ Reject"}
                  </button>
                </div>
              </div>
            ))}
            {reviewResults.filter(r => r.changed).length === 0 && (
              <p style={{ fontSize: "0.875rem", color: "var(--va-text-muted)", textAlign: "center", padding: "1rem" }}>
                ✓ All classifications look correct — no changes needed.
              </p>
            )}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div style={{ marginTop: "2rem" }}>
          <p style={{ color: "var(--va-text-muted)", fontSize: "0.875rem", marginBottom: "0.75rem" }}>
            {suggestions.length} entries detected across {new Set(suggestions.map(s => s.category)).size} categories. Fix any before importing.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {suggestions.map((item, index) => (
              <div key={index} style={{ background: "var(--va-surface)", border: "1px solid var(--va-border)", borderRadius: "0.5rem", padding: "1rem", display: "flex", gap: "1rem", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "var(--va-text)", fontSize: "0.875rem" }}>{item.text}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                  <span style={{ fontSize: "1.25rem" }}>{CATEGORY_ICONS[item.category]}</span>
                  <select value={item.category} onChange={(e) => updateCategory(index, e.target.value as StoryCategory)}
                    style={{ background: "var(--va-bg)", border: "1px solid var(--va-border)", borderRadius: "0.25rem", padding: "0.25rem 0.5rem", fontSize: "0.75rem", color: "var(--va-accent)", outline: "none", maxWidth: "140px" }}>
                    {ALL_CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
                  </select>
                  <button onClick={() => removeSuggestion(index)} style={{ color: "var(--va-text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: "1.25rem", lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}