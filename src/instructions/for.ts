import type { Instructions, SetInstructions } from '@/src/types/query';
import type { Schema } from '@/src/types/schema';
import {
  RONIN_SCHEMA_SYMBOLS,
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
  for (const presetSlug in instructions.for) {
    const args = instructions.for[presetSlug];
    const preset = schema.presets?.find((preset) => preset.slug === presetSlug);

    if (!preset) {
      throw new RoninError({
        message: `Preset "${presetSlug}" does not exist in schema "${schema.name}".`,
        code: 'PRESET_NOT_FOUND',
      });
    }

    const replacedForFilter = structuredClone(preset.instructions);

    findInObject(replacedForFilter, RONIN_SCHEMA_SYMBOLS.VALUE, (match: string) =>
      match.replace(RONIN_SCHEMA_SYMBOLS.VALUE, args),
    );

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
