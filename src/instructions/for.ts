import type { Schema } from '@/src/types/model';
import type { Instructions, SetInstructions } from '@/src/types/query';
import {
  RONIN_MODEL_SYMBOLS,
  RoninError,
  findInObject,
  isObject,
} from '@/src/utils/helpers';

/**
 * Generates the SQL syntax for the `for` query instruction, which allows for quickly
 * adding a list of pre-defined instructions to a query.
 *
 * @param schema - The schema associated with the current query.
 * @param instructions - The instructions of the current query.
 *
 * @returns The SQL syntax for the provided `for` instruction.
 */
export const handleFor = (
  schema: Schema,
  instructions: Instructions & SetInstructions,
): Instructions & SetInstructions => {
  // The `for` instruction might either contain an array of preset slugs, or an object
  // in which the keys are preset slugs and the values are arguments that should be
  // passed to the respective presets.
  const normalizedFor = Array.isArray(instructions.for)
    ? Object.fromEntries(instructions.for.map((presetSlug) => [presetSlug, null]))
    : instructions.for;

  for (const presetSlug in normalizedFor) {
    const arg = normalizedFor[presetSlug];
    const preset = schema.presets?.find((preset) => preset.slug === presetSlug);

    if (!preset) {
      throw new RoninError({
        message: `Preset "${presetSlug}" does not exist in schema "${schema.name}".`,
        code: 'PRESET_NOT_FOUND',
      });
    }

    const replacedForFilter = structuredClone(preset.instructions);

    // If an argument was provided for the preset, find the respective placeholders
    // inside the preset and replace them with the value of the actual argument.
    if (arg !== null) {
      findInObject(replacedForFilter, RONIN_MODEL_SYMBOLS.VALUE, (match: string) =>
        match.replace(RONIN_MODEL_SYMBOLS.VALUE, arg),
      );
    }

    for (const subInstruction in replacedForFilter) {
      const instructionName = subInstruction as keyof Instructions;
      const currentValue = instructions[instructionName];

      // If the instruction is already present in the query, merge its existing value with
      // the value of the instruction that is being added.
      if (currentValue) {
        let newValue: unknown;

        if (Array.isArray(currentValue)) {
          newValue = [
            ...(replacedForFilter[instructionName] as Array<unknown>),
            ...(currentValue as Array<unknown>),
          ];
        } else if (isObject(currentValue)) {
          newValue = {
            ...(replacedForFilter[instructionName] as object),
            ...(currentValue as object),
          };
        }

        Object.assign(instructions, { [instructionName]: newValue });
        continue;
      }

      // If the instruction isn't already present in the query, add it.
      Object.assign(instructions, {
        [instructionName]: replacedForFilter[instructionName],
      });
    }
  }

  return instructions;
};
