# Speak Revealed Card

## Goal

Automatically read a flashcard's translation when the user reveals it in card mode.

## Approved behavior

- When the user flips a card from source to target by clicking the card or pressing Space, speak the revealed target word using the existing voice preference and target-language selection.
- Do not speak automatically when a new card is shown or when the user flips back to the source side.
- Keep the existing speaker button behavior unchanged.

## Implementation scope

- Route both click and Space flip interactions through one shared card-flip function.
- After changing the card from source to target, speak the revealed translation in the target language.
- Keep navigation, card state, direction selection, and manual translation speech behavior unchanged.
- Add a focused regression test for speaking only when revealing the translation, using the existing frontend test conventions where practical.

## Verification

- Confirm the shared flip logic requests speech on reveal and does not request speech on flip-back.
- Run focused tests and JavaScript syntax checks.
- Do not run or leave the app running in the background.
- Do not commit without the user's explicit confirmation.
