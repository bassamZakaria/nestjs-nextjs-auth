import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export enum LogLevel {
  Fatal = 'fatal',
  Error = 'error',
  Warn = 'warn',
  Info = 'info',
  Debug = 'debug',
  Trace = 'trace',
  Silent = 'silent',
}

export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv;

  @IsString()
  @IsNotEmpty()
  HOST = '127.0.0.1';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT = 4000;

  @Matches(/^mongodb(\+srv)?:\/\//)
  MONGODB_URI: string;

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET: string;

  @IsUrl({ require_tld: false, require_protocol: true })
  APP_ORIGIN: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  TRUST_PROXY_HOPS = 0;

  @IsEnum(LogLevel)
  LOG_LEVEL = LogLevel.Info;
}

export const validateEnv = (config: Record<string, unknown>) => {
  const env = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(env);
  if (errors.length > 0) {
    throw new Error(`Invalid environment: ${errors.toString()}`);
  }
  env.APP_ORIGIN = new URL(env.APP_ORIGIN).origin;
  return env;
};
