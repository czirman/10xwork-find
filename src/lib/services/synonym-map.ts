/**
 * Developer-curated synonym map (FR-006) — the exclusive classification rule for
 * v1. Edited here, in source, not via the app UI. Seeded for the user's Java /
 * backend stack; coverage is what the ≥75% match-rate hypothesis is tested against.
 * Posting terms that miss surface in the unmatched list (FR-007) — that is the
 * signal to extend this map.
 *
 * Each key is a canonical skill name chosen to join the user's likely declared
 * skill (matched case-insensitively, punctuation-tolerantly via `matchKey`); the
 * array holds the phrasings real postings use. Keep synonyms specific — bare,
 * over-common words (e.g. "go") cause false positives under containment matching.
 */

import { buildSynonymIndex, type SynonymMap } from "@/lib/services/matching";

export const SYNONYM_MAP: SynonymMap = {
  Java: ["java", "core java", "java se", "j2ee", "jakarta ee", "jdk"],
  Spring: ["spring", "spring framework"],
  "Spring Boot": ["spring boot", "springboot"],
  Hibernate: ["hibernate", "jpa", "java persistence api"],
  REST: ["rest", "restful", "rest api", "restful api", "rest apis", "rest services"],
  SQL: ["sql", "relational database", "relational databases", "rdbms"],
  PostgreSQL: ["postgresql", "postgres"],
  MySQL: ["mysql"],
  MongoDB: ["mongodb", "mongo", "nosql"],
  Git: ["git", "version control", "version control system", "vcs", "source control"],
  Docker: ["docker", "containers", "containerization"],
  Kubernetes: ["kubernetes", "k8s"],
  "CI/CD": ["ci/cd", "ci cd", "continuous integration", "continuous delivery", "continuous deployment"],
  Jenkins: ["jenkins"],
  Maven: ["maven", "apache maven"],
  Gradle: ["gradle"],
  JUnit: ["junit"],
  Mockito: ["mockito"],
  Kafka: ["kafka", "apache kafka"],
  RabbitMQ: ["rabbitmq"],
  Microservices: ["microservices", "microservice", "microservice architecture", "microservices architecture"],
  Linux: ["linux", "unix"],
  AWS: ["aws", "amazon web services"],
  Agile: ["agile", "scrum"],
};

/** Inverted index built once at module load: matchKey(phrase) → canonical. */
export const SYNONYM_INDEX = buildSynonymIndex(SYNONYM_MAP);
