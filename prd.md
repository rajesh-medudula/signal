# Signal

## AI Customer Conversation Intelligence Platform

### V1 Product & Technical Specification

## 1. Product Definition

### Core problem

Businesses increasingly receive customer conversations across WhatsApp, Instagram, email, Telegram, Facebook Messenger, website chat, and other channels.

As message volume grows, the business owner cannot realistically read and understand every conversation.

The result is:

* Important customers get buried.
* Low-quality enquiries consume time.
* Customer questions are missed.
* Follow-ups are forgotten.
* Sales opportunities go cold.
* CRM information becomes outdated.
* The owner cannot clearly see which channel or conversation is producing business.

### Product solution

Signal connects to supported customer communication channels and creates an intelligent layer above them.

Signal analyzes conversations, extracts business-relevant information, identifies customer intent, prioritizes opportunities, maintains CRM information, recommends the next action, and drafts an appropriate response.

### Core promise

**Don't read every customer message. Know which conversations deserve your attention.**

---

# 2. Product Philosophy

Signal is NOT primarily:

* a chatbot
* a generic CRM
* a shared inbox
* a marketing automation platform

Signal is primarily:

> **An AI decision and prioritization layer for customer conversations.**

The CRM, analytics, summaries, and response generation exist around that core intelligence.

---

# 3. Primary User

V1 targets businesses that:

* receive customer enquiries online
* receive repeated enquiries every day
* sell products or services
* have meaningful value per customer
* currently manage conversations manually
* can lose revenue when enquiries are ignored

Initial target examples:

* freelancers
* web/design agencies
* marketing agencies
* photographers
* consultants
* interior designers
* event businesses
* other service businesses

We will initially avoid trying to serve every industry.

---

# 4. Core User Journey

## Step 1 — Registration

User creates a Signal account.

Required information:

* Name
* Email
* Password/authentication method
* Business name

---

## Step 2 — Business onboarding

Signal asks:

### About your business

* Business type
* What do you sell?
* Main products/services
* Typical price range
* Target customers
* Location/service area
* Website
* Main communication channels

### Communication preferences

* Preferred language for dashboard: English
* Preferred reply language
* Preferred tone:

  * professional
  * friendly
  * casual
  * short/direct
* Typical customer journey/sales process

This information becomes part of the AI's business context.

---

# 5. Channel Connections

The architecture must support multiple channels.

Planned channels:

* WhatsApp Business
* Gmail/email
* Instagram
* Telegram
* Facebook Messenger
* Website chat
* Future supported channels

Each integration is represented internally as:

`Channel → Connector → Normalized Message`

The AI layer must not care whether a message came from WhatsApp, Instagram, or Gmail.

It should receive one standard internal format.

Example:

```json
{
  "businessId": "...",
  "customerId": "...",
  "conversationId": "...",
  "channel": "instagram",
  "senderType": "customer",
  "timestamp": "...",
  "messageText": "website price entha bro?"
}
```

This abstraction is essential for future expansion.

---

# 6. V1 First Integration

V1 should begin with one integration rather than attempting WhatsApp + Instagram + Telegram + Gmail simultaneously.

### First implementation target

**Gmail**

Reason:

* clear OAuth flow
* official API
* message retrieval is supported
* Gmail provides message/thread IDs
* Gmail provides push-watch functionality for mailbox changes
* we can build and test the complete intelligence pipeline without waiting for several social-platform approvals

Google documents Gmail API access through OAuth scopes, message retrieval via `messages.list`/`messages.get`, and mailbox change notifications through `users.watch`.

The integration architecture will still be designed so WhatsApp and other channels plug into the same system later.

---

# 7. Conversation Ingestion

When a connected channel provides a new message:

```text
External platform
        ↓
Channel connector
        ↓
Webhook/poll/push mechanism
        ↓
Message normalization
        ↓
Database
        ↓
Conversation intelligence pipeline
```

The system stores the raw message securely and converts it into our internal message format.

---

# 8. Multilingual Intelligence — Core Requirement

Language support is not optional.

Signal must support conversations involving:

* English
* Hindi
* Telugu
* Tamil
* Kannada
* Malayalam
* Marathi
* Bengali
* other supported languages
* mixed-language messages
* Hinglish
* Telugish
* Tanglish
* informal/slang-heavy business conversations

Example:

> "Website price entha bro? Next week lopu kavali."

Signal should understand:

**Customer wants a website, is asking for price, and needs it before next week.**

The system should NOT depend on literal translation alone.

### Required pipeline

```text
Incoming conversation
        ↓
Language identification
        ↓
Multilingual normalization/understanding
        ↓
Conversation context
        ↓
Business-meaning extraction
        ↓
Structured intelligence
        ↓
English dashboard output
```

The dashboard defaults to English.

Customer-facing suggested replies can be generated in:

* English
* Hindi
* Telugu
* Tamil
* source language
* mixed style such as Hinglish/Telugish

The owner can choose or override the reply language.

---

# 9. Conversation Understanding

Signal analyzes conversations to extract:

### Customer identity

* Name
* Email
* Phone/handle
* Company
* Channel identifiers

### Customer requirement

* Product/service
* Quantity
* Features
* Preferences
* Specifications

### Commercial information

* Budget
* Potential deal value
* Pricing discussion
* Payment status

### Timing

* Deadline
* Event date
* Delivery date
* Follow-up date
* urgency

### Customer intent

Examples:

* information seeking
* casual enquiry
* interested
* qualified
* comparing options
* negotiating
* ready to buy
* existing customer
* support request
* complaint
* lost opportunity
* spam/irrelevant

### Objections

Examples:

* price
* timing
* trust
* feature concern
* competitor
* uncertainty

### Sentiment

* positive
* neutral
* frustrated
* negative

---

# 10. Lead / Opportunity Score

Every meaningful conversation receives an opportunity score.

Example:

`0–100`

The score combines deterministic signals and AI interpretation.

Potential signals:

* clear requirement
* asking about price
* requesting quotation
* purchase language
* deadline
* urgency
* high estimated value
* repeated engagement
* asking payment-related questions
* business has failed to answer
* time since last interaction
* customer explicitly comparing providers
* customer says they are ready to proceed

Example:

```text
94/100 — HIGH PRIORITY
```

The score must be explainable.

Example:

```text
Why 94?

✓ Specific requirement identified
✓ Customer asked for pricing
✓ Customer provided deadline
✓ Customer requested payment details
✓ High estimated deal value
```

The system should also store AI confidence separately from opportunity score.

---

# 11. Customer Status

Suggested status model:

```text
New
Interested
Qualified
Proposal
Negotiation
Ready to Buy
Won
Lost
Existing Customer
Support
```

AI can recommend status changes.

The business owner can always manually override them.

Manual override must take precedence over automatic classification until the user changes the setting.

---

# 12. Conversation Summary

Every important conversation receives an English summary.

Example:

```text
Customer wants a restaurant website with online ordering.
Approximate budget is ₹30,000–₹40,000.
Customer needs the project before September 15.
They are currently waiting for a quotation.
```

Summary should be:

* concise
* factual
* business-focused
* free of unnecessary conversational details

---

# 13. "What does the customer want?"

Signal should show a dedicated extraction section.

Example:

```text
CUSTOMER NEEDS

Service:
Restaurant website

Features:
Online ordering

Budget:
₹30,000–₹40,000

Deadline:
September 15

Unanswered question:
Can delivery be completed before September 15?
```

This lets the owner understand the customer without reading the conversation.

---

# 14. Recommended Next Action

Signal must recommend an action.

Possible actions:

* Reply now
* Answer a question
* Send pricing
* Send quotation
* Request missing information
* Schedule a call
* Follow up
* Wait
* Send payment information
* Escalate
* Mark as low priority
* No action required

Example:

```text
RECOMMENDED ACTION

Send quotation today.

Reason:
Customer has confirmed requirements and deadline
but is currently waiting for pricing.
```

---

# 15. AI Reply Generation

Signal generates a response based on:

* recent conversation
* customer requirements
* business profile
* business services
* previous relevant context
* business tone
* chosen language
* desired response length

Example:

```text
CUSTOMER:
"Can you finish it before Sept 15 and how much?"

SUGGESTED REPLY:

Yes, we can target September 15.
Based on the features you've mentioned,
the estimated cost would be around ₹40,000.
I can send you the detailed proposal and timeline.
```

Controls:

`Edit`
`Regenerate`
`Copy`
`Send` where platform integration supports it

### Safety rule

V1 should default to **human approval**.

Signal should not automatically send customer-facing messages unless the user explicitly enables an automation in a future version.

---

# 16. Unanswered Question Detection

Signal should detect when a customer asks something that has not been properly answered.

Example:

Customer:

> "Can you deliver by Friday?"

Business:

> "I'll check."

No subsequent answer.

Signal:

```text
⚠️ CUSTOMER QUESTION UNANSWERED

Question:
Can you deliver by Friday?

Recommended action:
Confirm delivery availability.
```

This is an important differentiator.

---

# 17. Follow-up Intelligence

Follow-up recommendations must consider context.

Do NOT simply:

`Last message > 3 days = follow up`

Instead consider:

* what the customer said
* whether they asked for time
* whether a question remains unanswered
* customer intent
* opportunity value
* previous interactions
* expected decision period
* business context

Example:

```text
Customer:
"I'll discuss with my partner and let you know."

Signal:
Wait 2–3 days before follow-up.
```

Another example:

```text
Customer:
"Please send payment details."

Business:
No response.

Signal:
🚨 Immediate action required.
```

---

# 18. Going-Cold Detection

Signal should identify previously valuable leads that are becoming inactive.

Example:

```text
⚠️ GOING COLD

Ravi Kumar

Opportunity:
₹40,000

Previous intent:
High

Last interaction:
6 days ago

Reason:
Customer showed purchase interest but the conversation
has become inactive.

Recommended:
Send a friendly follow-up.
```

---

# 19. Revenue-at-Risk

Signal should estimate potential revenue associated with neglected high-intent conversations.

Example:

```text
REVENUE AT RISK

₹1,85,000

12 high-intent conversations
require attention.
```

This should be presented as an estimate, not guaranteed revenue.

---

# 20. Main Dashboard

The dashboard should answer one question:

> **What deserves my attention today?**

Example:

```text
GOOD MORNING 👋

1,247 conversations analyzed

🔥 17 high-priority opportunities
⚠️ 9 customers waiting for your response
🕐 14 follow-ups due
❄️ 834 low-priority conversations

Estimated active opportunity:
₹3.8L
```

Then:

### Top opportunities

Each card shows:

* customer
* source
* opportunity score
* short summary
* requirement
* potential value
* current status
* reason for priority
* recommended action
* suggested reply

---

# 21. Conversation Detail Page

When opening a customer:

```text
CUSTOMER
Ravi Kumar

Priority:
94/100 🔥

Stage:
Qualified

Source:
Instagram

────────────────

AI SUMMARY

...

CUSTOMER NEEDS

...

KEY DETAILS

Budget:
₹40,000

Deadline:
Sept 15

────────────────

RECOMMENDED ACTION

Send quotation.

────────────────

SUGGESTED RESPONSE

...

[Edit]
[Copy]
[Send]

────────────────

CONVERSATION

Original messages
```

The original conversation remains accessible because AI summaries must never replace the source conversation completely.

---

# 22. Customer Profile

Each customer gets a unified profile.

```text
Ravi Kumar

Channels
Instagram
WhatsApp
Email

Services discussed
Website
Maintenance

Estimated value
₹40,000

Current stage
Qualified

First contacted
...

Last interaction
...

Last AI analysis
...
```

---

# 23. Cross-Channel Identity Resolution

The system should eventually recognize when:

```text
Instagram: Ravi Kumar
WhatsApp: Ravi
Email: ravi@example.com
```

may represent the same person.

Do not blindly merge.

Use confidence:

```text
Possible match: 93%
```

Strong matches can be merged automatically according to configurable rules.

Ambiguous matches should be presented to the user.

---

# 24. Lead Source Analytics

Signal must track:

```text
Lead source

Instagram
WhatsApp
Email
Telegram
Website
...
```

Then separate:

### Lead volume

from

### Conversion performance

Example:

```text
LEADS
Instagram 42%
WhatsApp 31%
Email 17%
Website 10%

CONVERSIONS
Instagram 47%
WhatsApp 31%
Email 12%
Website 10%
```

This helps businesses understand which channels actually generate customers.

---

# 25. AI Daily Briefing

A daily briefing should summarize the important business activity.

Example:

```text
TODAY'S BRIEFING

🔥 8 high-intent customers
⚠️ 5 overdue follow-ups
❓ 3 unanswered customer questions

TOP OPPORTUNITY
Ravi — ₹40,000

BIGGEST RISK
Priya — ₹25,000 lead has been inactive for 7 days.

MOST COMMON REQUEST
Restaurant website with online ordering.
```

---

# 26. AI Business Insights

As enough data accumulates, Signal can identify patterns:

* frequently requested services
* common objections
* most profitable source
* highest converting channel
* common customer questions
* common reasons for lost opportunities
* peak enquiry periods
* common price ranges
* common customer requirements

Example:

```text
CUSTOMER INSIGHT

42% of qualified customers asked about delivery time.

31% of lost leads mentioned price.

Instagram has the highest qualified-lead rate.
```

---

# 27. AI Architecture

The AI system should not make one giant prompt for every conversation.

Use a layered system.

### Layer 1 — Deterministic processing

Normal code handles:

* timestamps
* conversation grouping
* inactivity detection
* basic message metadata
* channel metadata
* duplicate detection
* obvious rules

### Layer 2 — AI extraction

AI handles:

* intent
* summary
* requirements
* budget
* deadline
* objections
* sentiment
* recommended action
* suggested response

### Layer 3 — Business rules

Application logic combines AI output with deterministic signals.

Example:

```text
AI intent = High
+
No owner reply = 8 hours
+
Estimated value = ₹40,000

→ Priority = Very High
```

This reduces AI cost and improves reliability.

---

# 28. AI Output Contract

The AI should return structured data rather than unrestricted prose.

Example:

```json
{
  "language": "te",
  "summary": "...",
  "customer_intent": "high",
  "lead_stage": "qualified",
  "opportunity_score": 91,
  "confidence": 0.93,
  "requirements": [],
  "budget": null,
  "deadline": "...",
  "objections": [],
  "unanswered_questions": [],
  "recommended_action": "...",
  "follow_up_recommended": true,
  "follow_up_date": "...",
  "suggested_reply": {
    "language": "telugu",
    "text": "..."
  }
}
```

The frontend displays friendly human-readable information.

---

# 29. Re-analysis Strategy

Do not send the entire conversation to the AI after every single message forever.

Instead:

```text
New message
   ↓
Check whether analysis is needed
   ↓
If minor:
update deterministic state

If meaningful:
run AI analysis
```

Meaningful events include:

* new customer requirement
* pricing discussion
* customer question
* customer objection
* purchase intent change
* stage change
* new deadline
* inactivity after important interaction
* customer complaint

This controls cost.

---

# 30. AI Cost Strategy

The business must never promise unlimited AI usage without understanding cost.

Usage should eventually be measured using:

* conversations analyzed
* AI tokens/credits
* connected channels
* advanced analysis features

Free plan gets limited AI usage.

Paid plans receive larger usage allowances.

The system must track internal AI consumption per account.

---

# 31. Free Plan

Initial proposed plan:

### Free

* 1 connected channel
* limited monthly conversation volume
* limited AI analyses
* customer profiles
* basic summaries
* opportunity scores
* basic suggested replies
* basic CRM stages
* basic follow-up detection

The free plan must be genuinely useful.

---

# 32. Pro Plan

### Pro

* multiple connected channels
* much higher conversation volume
* larger AI allowance
* advanced opportunity scoring
* going-cold detection
* unanswered-question detection
* advanced follow-up intelligence
* AI daily briefing
* advanced analytics
* custom business context
* custom reply style
* exports
* extended conversation history

Pricing is intentionally provisional and must be validated after measuring AI cost and user willingness to pay.

---

# 33. Team/Business Plan

Future:

* multiple users
* user roles
* assignment
* team ownership
* internal notes
* team analytics
* approval workflows
* higher usage limits
* automation

---

# 34. Security Requirements

Because Signal processes private customer conversations:

### Required

* OAuth where applicable
* encrypted tokens
* encrypted sensitive data
* strict tenant isolation
* server-side authorization
* least-privilege access
* secure secrets handling
* audit logging
* account deletion
* connection revocation
* data deletion controls
* HTTPS everywhere

Never expose provider access tokens to the browser.

---

# 35. AI Data Privacy

The system should clearly disclose:

* what data is collected
* which channels are connected
* why messages are processed
* what AI providers process data
* how long data is retained
* how the user disconnects a platform
* how the user deletes data

Never silently use customer conversations for unrelated purposes.

---

# 36. V1 Screens

V1 should contain:

1. Landing page
2. Sign up/login
3. Business onboarding
4. Connect channel
5. Dashboard
6. Conversations
7. Customer profile
8. Conversation detail
9. AI analysis panel
10. Leads/pipeline
11. Follow-ups
12. Basic analytics
13. Settings
14. Connected channels
15. Billing/plan page

---

# 37. Core Database Entities

Initial conceptual model:

```text
User
Business
ChannelConnection
Customer
CustomerIdentity
Conversation
Message
ConversationAnalysis
Lead
FollowUp
SuggestedReply
BusinessProfile
AIUsage
Subscription
AuditLog
```

Relationships:

```text
User
 └── Business
      ├── ChannelConnections
      ├── Customers
      │    └── CustomerIdentities
      ├── Conversations
      │    └── Messages
      ├── ConversationAnalyses
      ├── Leads
      ├── FollowUps
      ├── SuggestedReplies
      └── AIUsage
```

---

# 38. Important Design Rule

The raw conversation and AI interpretation must remain separate.

Example:

```text
RAW DATA
"What is the price bro? Need it by next Friday."

AI INTERPRETATION
Intent: high
Need: product/service
Deadline: next Friday
Action: provide quotation
```

If the AI interpretation is wrong, we should be able to reprocess the original conversation.

---

# 39. Human Override

Every important AI decision should be editable.

Owner can change:

* status
* score
* customer information
* priority
* follow-up date
* summary
* language
* recommended action

Human corrections should be stored and may later be used to improve personalization.

---

# 40. What V1 Will NOT Do

To prevent scope explosion, V1 will not initially include:

* fully autonomous customer replies
* all social platforms
* mobile application
* complex marketing automation
* advanced sales forecasting
* payment processing
* huge enterprise permissions system
* voice-call analysis
* AI phone agent
* complete accounting system

Those are future features.

---

# 41. V1 Success Metric

The primary metric is NOT:

`number of messages analyzed`

It is:

> **How much useful customer attention does Signal surface from a large volume of conversations?**

Important product metrics:

* percentage of analyzed conversations classified
* AI classification accuracy
* false high-priority rate
* missed high-intent opportunities
* suggested-reply acceptance/edit rate
* follow-up action rate
* customer conversion rate
* time saved per business
* weekly active businesses
* free → paid conversion
* average AI cost per paid customer

---

# 42. Product North Star

The long-term product should move toward:

```text
Thousands of customer conversations
                 ↓
          Signal understands
                 ↓
       Business sees 10–20
       important opportunities
                 ↓
         Owner takes action
                 ↓
            More sales
```

The fundamental value is:

> **Reduce customer-conversation noise while increasing the number of valuable opportunities the business actually acts on.**

---

# 43. Development Strategy

The system must be built in independent modules.

Recommended order:

### Module 1

Project foundation

### Module 2

Authentication

### Module 3

Business onboarding

### Module 4

Database and tenant architecture

### Module 5

Conversation/message data model

### Module 6

First channel connector

### Module 7

Conversation ingestion

### Module 8

Multilingual AI analysis

### Module 9

Customer profile

### Module 10

Opportunity scoring

### Module 11

Dashboard

### Module 12

Suggested responses

### Module 13

CRM stages

### Module 14

Follow-up intelligence

### Module 15

Analytics

### Module 16

Billing and usage limits

### Module 17

Security hardening

### Module 18

Testing and launch

---

# 44. How We Use Claude

Claude should receive small, testable assignments.

Never:

> "Build Signal completely."

Instead:

> "Implement Module 3 according to this specification."

Then we:

```text
Claude writes
       ↓
We run it
       ↓
You test manually
       ↓
We identify issues
       ↓
Claude fixes
       ↓
We verify again
```

Each completed module becomes a stable foundation for the next one.

---

# 45. First Milestone

Before connecting a real social platform, the first working prototype should be able to:

```text
User registers
      ↓
Creates business profile
      ↓
Imports sample customer conversations
      ↓
Signal detects language
      ↓
Signal understands mixed-language messages
      ↓
Signal creates customer summary
      ↓
Signal extracts requirements
      ↓
Signal scores opportunity
      ↓
Signal chooses CRM stage
      ↓
Signal recommends next action
      ↓
Signal generates suggested reply
      ↓
Dashboard displays prioritized opportunities
```

This is our **AI product proof**.

Once this works reliably, we connect the first real channel.

---

# 46. First Technical Principle

The product must be **channel-independent**.

Today:

`Gmail → Signal`

Tomorrow:

`WhatsApp → Signal`

Then:

`Instagram → Signal`

Then:

`Telegram → Signal`

The intelligence engine should remain the same.

Only the connector changes.

---

# 47. Final V1 Definition

Signal V1 is:

> **A multilingual AI customer-conversation intelligence platform that connects to a business communication channel, understands customer conversations, identifies high-value opportunities, summarizes what each customer needs in English, recommends what the business should do next, generates an appropriate reply, and maintains CRM information automatically.**
