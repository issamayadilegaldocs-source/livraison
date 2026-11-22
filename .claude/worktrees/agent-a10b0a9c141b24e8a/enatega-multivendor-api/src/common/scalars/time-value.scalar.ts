import { BadRequestException } from '@nestjs/common';
import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';

export type TimeValueInput = string | [string, string] | string[];

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function padTimePart(value: string): string {
  return value.padStart(2, '0');
}

export function normalizeTimeValue(value: TimeValueInput | null | undefined): string | undefined {
  if (value == null) return undefined;

  if (typeof value === 'string') {
    return value;
  }

  if (Array.isArray(value) && value.length === 2 && value.every((part) => typeof part === 'string')) {
    return `${padTimePart(value[0])}:${padTimePart(value[1])}`;
  }

  throw new BadRequestException('Time values must be "HH:MM" strings or ["HH", "MM"] arrays');
}

function parseTimeValue(value: TimeValueInput | null | undefined): string | undefined {
  const normalized = normalizeTimeValue(value);
  if (normalized == null) return undefined;
  if (!TIME_PATTERN.test(normalized)) {
    throw new BadRequestException('Time values must match HH:MM in 24-hour format');
  }
  return normalized;
}

function isTimeValueInput(value: unknown): value is TimeValueInput {
  return typeof value === 'string' || Array.isArray(value);
}

@Scalar('TimeValue')
export class TimeValueScalar implements CustomScalar<unknown, string | undefined> {
  description = 'Time value accepted as a canonical "HH:MM" string or legacy ["HH", "MM"] array';

  parseValue(value: unknown): string | undefined {
    if (!isTimeValueInput(value)) {
      throw new BadRequestException('Time values must be strings or string arrays');
    }
    return parseTimeValue(value);
  }

  serialize(value: unknown): string | undefined {
    if (!isTimeValueInput(value)) {
      throw new BadRequestException('Time values must be strings or string arrays');
    }
    return parseTimeValue(value);
  }

  parseLiteral(ast: ValueNode): string | undefined {
    if (ast.kind === Kind.STRING) {
      return parseTimeValue(ast.value);
    }

    if (ast.kind === Kind.LIST) {
      return parseTimeValue(
        ast.values.map((node) => {
          if (node.kind !== Kind.STRING) {
            throw new BadRequestException('Time array values must be strings');
          }
          return node.value;
        }),
      );
    }

    throw new BadRequestException('Time values must be strings or string arrays');
  }
}
