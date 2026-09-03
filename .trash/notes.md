# Analyst Agent creation prompt:
Let's start talking about Agents. I want to create an agent that will read the newly incoming and outgoing emails the email DB, analyse them based on their content, and tell if it belongs to any of the following:
1. New, possible lead: Someone is interested in purchasing product from CoolKonyha;
2. ongoing business where the customer or the product provider has sent new information relevant to the ongoing business;
3. spam email;
4. other information that is irrelevant for the business, might be private.
I want this Agent to highlight relevat new information, and give proposal for next steps. The agent should make sure that every email is processed only once, but every email should be processed. Come up with a way that the Agent can identify the 

˙[] Tools

# Test Agent

Create a test Agent for me. It should be able to do any unit, integration or E2E test for any other agent, or any other part of the system. It should be able to read the other agents' code, understand their logic, and create test cases for them. It should be able to run the tests and report the results. It should be able to create test data and test scenarios. Every test should be documented in the docs/tests/ folder.
The test agent should be able to run in a sandbox environment, and should not be able to modify any other part of the system. I should be able to run the test agent manually.
The test agent should always re-learn how the whole or the part of the system works before running the test. I should only do a re-learn of the parts that is needed for the test.

≡ƒöì [TEST AGENT] Re-Learn Phase ΓÇö scope: all
## [RE-LEARN] Phase Report
### Files Skipped
## [RE-LEARN] Phase Report
### Files Skipped
  Γ£ö throws an error for an invalid status key (before any DB write) (0.5895
ms)
  Γ£ö throws an error when the product does not exist (0.4521ms)
## [RE-LEARN] Phase Report
### Files Skipped
## [RE-LEARN] Phase Report
### Files Skipped
Γä╣ pass 36
Γä╣ fail 0
Γä╣ skipped 0
≡ƒº¬ TEST AGENT REPORT ΓÇö scope: all
   Γ£à Passed:  51
   Γ¥î Failed:  0
   ΓÅ¡  Skipped: 0
≡ƒôä Report saved: docs/tests/reports/run-2026-03-01T16-46-16-298Z.md