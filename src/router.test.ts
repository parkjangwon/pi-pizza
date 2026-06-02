import { describe, it, expect } from "vitest";
import { isPlanningRequest } from "./router.ts";
import type { Context, Message } from "@earendil-works/pi-ai";

function makeContext(systemPrompt: string, messages: Message[]): Context {
	return {
		systemPrompt,
		messages,
	} as Context;
}

describe("isPlanningRequest", () => {
	describe("old format: <skill name='X'>", () => {
		it("detects plan skill in user message", () => {
			const ctx = makeContext("", [
				{
					role: "user",
					content: '<skill name="plan" location="...">\n...\n</skill>',
					timestamp: 0,
				},
			] as Message[]);
			expect(isPlanningRequest(ctx, "")).toBe(true);
		});

		it("detects ralplan skill in user message", () => {
			const ctx = makeContext("", [
				{
					role: "user",
					content: '<skill name="ralplan" location=".../SKILL.md">',
					timestamp: 0,
				},
			] as Message[]);
			expect(isPlanningRequest(ctx, "")).toBe(true);
		});

		it("detects in systemPrompt property", () => {
			const ctx = makeContext(
				'Some text <skill name="writing-plans" location="/x">',
				[],
			);
			expect(isPlanningRequest(ctx, "")).toBe(true);
		});
	});

	describe("new format: <name>X</name> (formatSkillsForPrompt)", () => {
		it("ignores plan skill when it only appears in available_skills", () => {
			const ctx = makeContext("", [
				{
					role: "user",
					content: `<available_skills>
  <skill>
    <name>plan</name>
    <description>Plan creates comprehensive plans</description>
    <location>/skills/plan/SKILL.md</location>
  </skill>
</available_skills>`,
					timestamp: 0,
				},
			] as Message[]);
			expect(isPlanningRequest(ctx, "")).toBe(false);
		});

		it("detects ralplan skill via <name> element", () => {
			const ctx = makeContext("", [
				{
					role: "user",
					content: `<skill>
    <name>ralplan</name>
    <description>Consensus planning alias</description>
    <location>/skills/ralplan/SKILL.md</location>
  </skill>`,
					timestamp: 0,
				},
			] as Message[]);
			expect(isPlanningRequest(ctx, "")).toBe(true);
		});

		it("ignores systemPrompt available_skills blocks", () => {
			const ctx = makeContext(
				`<available_skills>
  <skill>
    <name>ralplan</name>
    <description>Consensus Planning Alias</description>
    <location>/Users/pjw/.agents/skills/ralplan/SKILL.md</location>
  </skill>
  <skill>
    <name>plan</name>
    <description>Plan creates comprehensive plans</description>
    <location>/Users/pjw/.agents/skills/plan/SKILL.md</location>
  </skill>
</available_skills>`,
				[],
			);
			expect(isPlanningRequest(ctx, "")).toBe(false);
		});

		it("detects executing-plans skill via <name> element", () => {
			const ctx = makeContext("", [
				{
					role: "user",
					content: `<skill><name>executing-plans</name><location>/x</location></skill>`,
					timestamp: 0,
				},
			] as Message[]);
			expect(isPlanningRequest(ctx, "")).toBe(true);
		});
	});

	describe("prefix match: /plan, /skill:X", () => {
		it("matches /plan prefix", () => {
			expect(
				isPlanningRequest(makeContext("", []), "/plan feature improvement"),
			).toBe(true);
		});

		it("matches /skill:ralplan prefix", () => {
			expect(
				isPlanningRequest(makeContext("", []), "/skill:ralplan do something"),
			).toBe(true);
		});

		it("matches /skill:plan prefix", () => {
			expect(
				isPlanningRequest(makeContext("", []), "/skill:plan add auth"),
			).toBe(true);
		});

		it("matches /skill:writing-plans prefix", () => {
			expect(
				isPlanningRequest(makeContext("", []), "/skill:writing-plans design"),
			).toBe(true);
		});
	});

	describe("no match cases", () => {
		it("returns false for empty context", () => {
			expect(isPlanningRequest(makeContext("", []), "")).toBe(false);
		});

		it("returns false for normal user prompt without skill markers", () => {
			const ctx = makeContext("", [
				{ role: "user", content: "hello, can you help?", timestamp: 0 },
			] as Message[]);
			expect(isPlanningRequest(ctx, "hello, can you help?")).toBe(false);
		});

		it("returns false for non-planning skill name in <name> format", () => {
			const ctx = makeContext("", [
				{
					role: "user",
					content: `<skill><name>some-other-skill</name></skill>`,
					timestamp: 0,
				},
			] as Message[]);
			expect(isPlanningRequest(ctx, "")).toBe(false);
		});

		it("returns false for non-planning skill name in old format", () => {
			const ctx = makeContext("", [
				{
					role: "user",
					content: '<skill name="not-a-plan" location="/x/SKILL.md">',
					timestamp: 0,
				},
			] as Message[]);
			expect(isPlanningRequest(ctx, "")).toBe(false);
		});

		it("returns false when only non-planning skills are present", () => {
			const ctx = makeContext(
				`<available_skills>
  <skill>
    <name>debugging</name>
    <description>Debugging skill</description>
    <location>/x/debug/SKILL.md</location>
  </skill>
</available_skills>`,
				[],
			);
			expect(isPlanningRequest(ctx, "")).toBe(false);
		});
	});
});
