# Stars of the City - SotC - FoundryVTT System

Built to support the Stars of the City system made by JakkaFang, behold my great work. For those who played Ruina or are still 
playing Limbus Company but desire more content, wait no longer. Now you can make it yourself with some beautiful dice and status effect 
gameplay. Let your gameplay utterly thrive, with quality of life features like quick damage application, emotion gain, and a HUD to 
easily add status effects as they're inflicted. Oh, and, if you'll probably want a link to the TTRPG system as well:

https://docs.google.com/document/d/1BnU-VNWkLPjhtYfSfpaErkzdUd_LYk2deGrSQgsatXk/edit?usp=sharing

For a full experience of the features, I will at some point make a tutorial video (or Jakka might make one), so for now
please enjoy this Feature Forecast instead (it's much easier to list what I intend to do, instead of what I've already 
done <- though you can look at the changelog below for the most recent update):

Feature Forecast
 - Application of modules to skills as structured data so that they can take effect
	- i.e. dice readout includes a button for "Apply X Burn" using the foundry target system to apply a status effect. This would require the 
	  hookup of dice modules as more than just text
	- Actual activation of on use and after use as more than text
	- Easy implementation of [check] tags
 - Addition of a clash wizard that lets clashing be resolved even more quickly and completely (and even dynamically in some cases!)
 - Add a level up wizard (and of course make it optional, we LOVE homebrew support here)
 - Maybe eventually make passive entries also be able to apply bonuses, like Ruina keypages would
 - Add language support for any requested languages
 - Implementation of blaze, eventually
 - NPC Sheet (Currently you can use the simplified sheet in settings)
 - Automation of anxieties and injuries for attempts

Requested Changes
 - Tsuchigumo and TrueQueenOfRose: Let status effects target/be applied to skills on the character's sheet, for effects like Ember or Pebble or Lock
					the intention being to either mechanically change power, light cost, or mechanically change something on roll

Now, I'll add these gradually over time, but I'd also like to more or less have my finger on the pulse of the users as for what new features are wanted
To this end, please feel free to contact my, Tsubasa, via my discord: tsubasa______

Changelog - v1.06:

Actor Sheet Changes
- Statuses can now be dragged around between actors and the compendium via grab bars
- Skills, Statuses, Passives, and Biography entries can now be dragged around to reorder them
- Spent 3 hours making a custom checkbox to show if an EGO's passive is active or not
- Added a field for starting excellence (excellence is now displayed as "Excellence: X / Y")
- Made the space for battle abilities larger
- Items on the actor sheet now display what they represent when hovered, i.e. emotion, light regen identify themselves when hovered (for you new players <3)
- Added a settings tab
- Moved the initiative type (player or npc) to the settings tab
- Added a setting for a simplified actor sheet, intended for NPCs and Enemies

Skill Changes (including EGOs):
- Added indicators for critical successes and failures on skill rolls
- Made it possible to resize the skill module section (where you put on use and after use things) vertically
- Made it possible to drag egos around, including between sheets and to the compendium (note, you can't write the details of the ego passive in from the compendium, you'll have to do that by editing on an actor sheet. The details of the ego passive WILL be saved when dragging the ego around though, so it's a suitable workaround)
- Made it possible to print ego passives to the chat


Combat Changes <- (I just didn't know where else to put this one)
- Added a button on rolls that you can click to quickly increment actor emotion

Misc Changes
- Changed the styling of chat messages. Looks neato if you ask me, hopefully the stark change doesn't cause ya any issues

Misc Bug Fixes
- Vani fixed a big where mook units (unlinked units using the same actor sheet as unlinked tokens) wouldn't have their scene-end effects handled correctly
- Fixed a bug where apostrophes and quotation marks in skill names would break the damage wizard
- Fixed a bug where sometimes item order on an actor sheet would get shuffled, seemingly at random
- Fixed a bug where skills with extremely long names would cause formatting issues
- Fixed a bug with runaway negative values for HP, Stagger, and Emotion
- Fixed a bug with skill rolls where the "Show Roll Details" would basically just about never work
- Fixed a bug where biography entries would overlap with the larger biography text block

Status Effect Changes:
- Fixed the status effect HUD for v11-v13
- Statuses can now (passively) effect multiple different values (i.e. *In*crease Offensive power and *De*crease Defensive power)
- Added the option for statuses to give power to non-counter dice (for effects like confrontational)
- Fixed a bug where sometimes rendered statuses would explode when a bunch got modified in quick succession (usually at round end or seemingly when applying staggered)
- Fixed a bug where stagger effects applied through the status HUD were set up wrong and did not function as intended
- Statuses that modify light regen and number of speed dice now display their effects on the character sheet AND actually mechanically increase end of round light regen / number of speed dice for the actor respectively
- Status effects that change max HP/Stagger/Light are no longer cosmetic and now appropriately change values on the character sheet (raw value is conserved, so you will not lose it)
- Made damage done by status effects round down (for enemies that take 50% reduced damage from status effects like burn, sinking, etc, where you would enter enter 0.5 damage per count)
- Increased the size of the status effect description box and made it possible to resize vertically
- Added an option to print only the special details / flavour text of a status effect (also added a setting to make this the default printing option when printing from the actor sheet)
- Added new Limbus Company status icons to the assets folder

Integrations from Vani's fork:
- When rolling initiative using the Roll All or Roll NPC button, we get a single Ruina Fingersnap instead of 30 deafening rolls
- When rolling initiative using the Roll All or Roll NPC button, the results are grouped together in a single chat message
- Modifications to speed dice now dynamically update the number of speed dice the actor has in initiative on round start
- Added a minimum HP/Stagger option for status effects (i.e. Sinking puts you to a minimum stagger of 1 unless triggering Sinking Deluge)
- Added various pieces of safety and bug fixes for combat related hooks

Things NOT integrated:
- Clash Detection
- Bleed Automation
- Status Effect Enrichment
- EGO Slotting
- EGO and Passive Badges
Why not? These are some excellent features, but for this update I have chosen not to add them for two separate reasons. For Clash Detection, Bleed Automation, and Status Effect Enrichment, I intend to go in a slightly different direction. In my next I'll be adding a new item type called "Modules", which live on skills and provide the effects of modules (i.e [Clash Win] Inflict 3 Burn or [Check] Gain X Power if target has Y of Z Status effect) as structured data. With this new item type, I will make a clash wizard which directly manages the clash between two skills such that it accurately determines the final outcome. It'll be nice, it's just a lot of work that I couldn't fit into this particular update (or you'd be reading this in half a year). 

As for the EGO Slotting and EGO & Passive Badges, those are also excluded for the sake of scope management. Next update I'll add them, especially the EGO & Passive Badges feature since that one seems really useful. I might even make it so that the badge can be clicked on to open up a sort of sheet showing all the passives? I know that'd be nice for the games I'm in where we've got 7 limbillion paragraphs of passives to keep track of

Notes for Devs (I love you all so much <3333):
- Max HP/Stagger/Light are directly modified by status effects where appropriate (so that resource bars access the correct value). Access system.health (or stagger or light).raw for the stable value
- The effects of status effects are now stored as an array in system.passive_effects, for the sake of status effects doing multiple things
- For the above, the system conducts a migration for ANY version that is not 1.06 (see end of sotc.js). This is done aggressively because I neglected to store a version number previously (the one in system.json isn't really stored cuz it gets overwritten on update). Future updates will be able to check for v1.06 as a reference point for identifying if any migrations need to be done
- Several instances of logic for on scene modification of an actor (i.e with combatRound status management) now find the original version of an actor to use a the source of truth for status effects on that actor. This is done because v13 does not use the same actor data for clones (clones don't have status effects) whereas v11 did have clones reference the original actor data
- Unlike in Vani's version, my implementation of the minimum hp/stagger a status can bring you to is stored as system.min_stat and applies to everything the status does except triggers that use the Sinking Deluge trigger option
- You may encounter bits and pieces of things that are unused or commented out (i.e. skill modules or a HUD I'm working on for status triggering), so if something seems out of place it may just be because it's not used. You should also be able to see where I'm angling with the whole skill module thing looking through template.json and sotc>template>wip stuff
- Added like 5 million comments for things that I went back and redid during bugfixing
- Good luck on anything you do, you beautiful people


Credit to Atropos for the (now very distant) boilerplate that let this all get started