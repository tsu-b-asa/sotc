# Formerly the Simple Worldbuilding System, modified for SotC

A simple game system for Foundry VTT which allows for flexible definition of Actors and Items to assist with worldbuilding or for running games which do not have a more complete system implementation available. - Atropos

Or that is how it was originally. It is now... very specialized. It's not exceptionally complicated at any given point. The code is all fairly straight forward.
But still, it's not so mundane or generic anymore. This is targeted for the Stars of the City system made by JakkaFang, but could also be used for other
Library of Ruina / Limbus inspired systems. I may even eventually make a version of the system that permits coin based gameplay, instead of dice based.

But for now, this is a fairly basic implementation that in the future will have several things added, as below.

Feature Forecast
 - Modification of Dice Rolls and Derived Character Sheet Statistics by the effects of passive status effects. This will likely mimic the pathfinder system,
	it's solely due to scope limitation that this version doesn't already include this particular feature
 - Application of modules to skills that actually have active or passive effects
	- i.e. dice readout includes a button for "Apply X Burn" using the foundry target system to apply a status effect. This would require the 
	  hookup of dice modules as more than just text
	- Actual activation of on use and after use as more than text
	- Easy implementation of [check] tags
	- Improval of dice and module readout when skills are printed, particularly to avoid some aggressive whitespace trimming <- Done this last part!
 - Implementation of blaze, maybe? The problem is that, even though I could nuke every npc with burn pretty easily I'd need to get an IFF system
 - Improved skill visuals for dice display, module tracking, other cosmetic modifications
 - Set up biography to use the same function as the passives <- Done!
 - Maybe eventually make passive entries also be able to apply bonuses, like Ruina keypages would
 - Add level up mechanics for minor improvements
 - ADD LANGUAGE SUPPORT FOR REQUESTED LANGUAGES
 - Make the attributes rollable

Requested Changes
 - Jakka: Add a category for status effects that is "Other" or "Special", for things that are none of the major 4
 - Tsuchigumo and TrueQueenOfRose: Let status effects target/be applied to skills on the character's sheet, for effects like Ember or Pebble or Lock
					the intention being to either mechanically change power, light cost, or mechanically change something on roll

Now, I'll add these gradually over time, but I'd also like to more or less have my finger on the pulse of the users as for what new features are wanted
To this end, please feel free to contact my, Tsubasa, via my discord: tsubasa______

Changelog:
v1.01
 - Resolved an issue with initiative, in which player connected machines would rerun initiative logic and EXPLODE the order with duplicates (sotc.js)
 - Corrected Strength to Might on the character sheet (actor-sheet.html)
 - Made the dice section of skills scrollable, for instances with a lot of modules or a lot of dice. Go forth and be absurd (sotc.css)
 - Changed the printout of modules placed on skills for the chat dialog so that there was less aggressive whitespace trimming (actor-sheet.js)
 - Fixed an issue in which status effects with long names would have bad formatting (sotc.css)
 - Added an "Other" option for status effects (template.json, status-sheet.html, actor-sheet.html, actor-sheet.js)
 - Added the option for status effects to result in a flat increase, regardless of count, alla Strider [Mao] (actor-sheet.html, status-sheet.html)
 - Added an option for a status to target "All Dice Power" (status-sheet.html)
 - Changed the biography tab to use the same entry format as the passives tab, allowing for potentially infinite biography entries and printability (actor-sheet.js, actor-sheet.html)
 - Updated the formatting for the Passives (and now Biography) tab to better accommodate larger entries (sotc.css, actor-sheet.html)
