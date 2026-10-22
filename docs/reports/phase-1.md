# تقرير المرحلة 0+1: الأساس وعقد الـ Registry على Sepolia

> المرحلة دي غطت Phase 0 (تجهيز الـ repo) وPhase 1 (الـ credential-core والعقد) من `docs/ROADMAP.md`. الخطة التفصيلية: `docs/plans/2026-09-28-phase-0-1-foundation-and-registry.md`. الـ commits من `0862a67c` لحد `2a45bdfd`.

## 1. ملخص في 5 سطور
- الـ v1 اتنقل لـ `legacy/` (مرجع بس، مش بيتبني ولا بيتعمله test)، والـ repo بقى npm workspaces (كذا package في repo واحد بـ `npm ci` واحد).
- اتبنت `@not/credential-core`: مكتبة TypeScript بتحسب hash الشهادة بشكل ثابت (canonical JSON مع salt) وبتبني Merkle tree لدفعة شهادات.
- اتبنى عقد `CredentialRegistry` (Solidity): جامعات بهوية ثابتة، محافظ موقّعة تتغير، `anchorBatch` بتكلفة ثابتة مهما كان حجم الدفعة، `revoke`، `revokeBatch`، `verify`، و`pause`.
- العقد اتنشر على Sepolia (شبكة اختبار لـ Ethereum) على العنوان `0x5ea33609e04C42f2C825EBf8D3Dc8F70B41Dbb5C`.
- الجديد: أي حد يقدر يتأكد on-chain إن شهادة معينة جزء من دفعة جامعة معينة ومتلغتش، من غير ما أي بيانات شخصية تتحط على الـ chain.

## 2. الباك إند: اتعمل إيه وليه

مفيش API ولا worker في المرحلة دي. "الباك إند" هنا هو المكتبة والعقد.

### 2.1 تجهيز الـ repo (Phase 0)
- **اتعمل إيه:** نقل v1 لـ `legacy/`، root `package.json` بـ workspaces، docs الـ v2، و CI (Continuous Integration: تشغيل تلقائي للـ build والـ tests) في `.github/workflows/ci.yml` بيعمل `npm ci` و`npm test` على push لـ main وعلى أي PR. وفي `f80ee737` بطّلنا نتتبع `legacy/artifacts` (ملفات build قديمة مكانهاش git).
- **اشتغل إزاي:** `npm test` في الـ root بيعمل build وtest لكل workspace.
- **ليه بالطريقة دي:** مراجعة v1 (`docs/reviews/2026-09-28-v1-review.md`) وضحت إن التصليح جوه الكود القديم أغلى من بداية نظيفة، بس محتاجينه مرجع.
- **الملفات المهمة:** `package.json`، `.github/workflows/ci.yml`.

### 2.2 `@not/credential-core`
- **اتعمل إيه:** `canonicalJson` و`computeCredentialHash` و Merkle batch builder مع تحقق محلي من الـ proof.
- **اشتغل إزاي:** `canonicalJson` بيرتب المفاتيح ويطلع نفس النص لنفس البيانات دايمًا، فالـ hash ميتغيرش لو ترتيب الحقول اتغير. الـ hash فيه salt (قيمة عشوائية سرية) عشان محدش يقدر يخمّن بيانات طالب ويجرب hashes لحد ما يلاقي تطابق. الدفعة بتتحول لـ Merkle tree (شجرة hashes جذرها، الـ root، بيمثل كل الشهادات)، وكل شهادة ليها proof (سلسلة hashes طولها حوالي log2(N)) تثبت إنها جوه الـ root.
- **ليه بالطريقة دي:** فيه frozen test vector (قيمة hash محفوظة في الـ test متتغيرش أبدًا) عشان أي تغيير في الصيغة يكسر الـ test بدل ما يكسر شهادات قديمة بصمت (قاعدة 4 في CLAUDE.md). البديل المرفوض: `JSON.stringify` العادي، لأن ترتيب المفاتيح فيه مش مضمون يفضل ثابت مع تغيّر الكود.
- **الملفات المهمة:** `packages/credential-core/src/canonical-json.ts`، `credential-hash.ts`، `merkle-batch.ts`.

### 2.3 عقد `CredentialRegistry`
- **اتعمل إيه:** تسجيل وتعليق وإرجاع جامعة، إضافة وشيل موقّعين، `anchorBatch(root, size)`، `revoke(...)` لشهادة واحدة بـ proof، `revokeBatch` للـ admin بس، `verify` كـ `view` (قراءة مجانية مش transaction)، و`pause`.
- **اشتغل إزاي:** الدفعة متخزنة بمفتاح `(institutionId, root)` في storage slot واحد (timestamp وsize وعنوان الموقّع = 32 byte)، فالتكلفة ثابتة. الإلغاء مفتاحه `(institutionId, root, credentialHash)`، فإلغاء في جامعة ميأثرش على جامعة تانية حتى لو نفس الـ root. الأخطاء custom errors (أرخص من رسائل نصية)، ومن ضمنها `InstitutionNotSuspended` اللي اتضاف بعد المراجعة عشان `reinstateInstitution` يرفض جامعة مش متعلقة أصلًا.
- **ليه بالطريقة دي:** كل تفصيلة هنا جت من finding في المراجعة، شوف القسم 4. العقد مش upgradeable (مفيش proxy) حسب قاعدة 14، عشان محدش، ولا حتى إحنا، يقدر يغير قواعد الشهادات اللي اتصدرت.
- **الملفات المهمة:** `packages/contracts/contracts/CredentialRegistry.sol`، `packages/contracts/test/CredentialRegistry.test.js`، `packages/contracts/test/integration.credential-core.test.js`.

### 2.4 سكريبت النشر
- **اتعمل إيه:** `packages/contracts/scripts/deploy.js` بيكتب `packages/contracts/deployments/<network>.json`.
- **ليه بالطريقة دي:** بعد المراجعة (`f4dfed34`) بقى يطلب عنوان admin صريح على أي شبكة غير شبكات التطوير، عشان محدش ينشر بالغلط والـ admin هو محفظة الـ deployer من غير ما يقصد. وكمان بيشيل الـ RPC URL (عنوان الاتصال بالـ node، وغالبًا فيه API key) من رسائل الخطأ.

## 3. الفرونت إند: اتعمل إيه وليه
مفيش فرونت إند في المرحلة دي. صفحة التحقق والـ portals جايين في مراحل بعد كده حسب `docs/ROADMAP.md`.

## 4. القرارات المهمة
| القرار | البدائل اللي اتقارنت | ليه اخترنا ده | التمن اللي دفعناه (trade-off) | ADR |
|---|---|---|---|---|
| مفتاح الدفعة `(issuer, root)` مش `root` بس | root عالمي فريد | مع root عالمي، أي حد يشوف الـ tx في الـ mempool (طابور المعاملات قبل ما تدخل block) يقدر يعمل front-running (يسبقك بنفس الـ root) ويحجزه أو يخطفه | `verify` لازم ياخد الجامعة كمان | `docs/decisions/0001-batch-key-issuer-root.md` |
| الجامعة ليها `institutionId` ثابت والمحافظ موقّعين يتغيروا | الجامعة = عنوان محفظة | لو المحفظة اتسرقت أو اتغيرت، الشهادات القديمة تفضل VALID والمحفظة الجديدة تقدر تلغي دفعات القديمة | طبقة mapping زيادة من الموقّع للجامعة | `docs/decisions/0002-institution-id-and-rotatable-signers.md` |
| عنوان الـ admin بيتمرر صريح في الـ constructor | الـ admin = الـ deployer تلقائيًا | يسمح إنه يبقى multisig (محفظة محتاجة توقيع أكتر من شخص) من الأول، ويمنع إن مفتاح النشر يفضل مسيطر | خطوة زيادة وقت النشر | `docs/decisions/0003-admin-address.md` |
| `revokeBatch` للـ admin بس | نسمح للموقّعين كمان | مفتاح موقّع مسروق كان هيقدر يلغي كل دفعات الجامعة (كل الـ roots علنية). الـ admin بيلغي دفعة مزيفة كاملة من غير ما يعرف أوراقها | الجامعة محتاجة الـ admin عشان تلغي دفعة كاملة | `docs/decisions/0004-stolen-signer-key-revoke-batch.md` |
| الـ admin هو أساس الثقة، وبنحرسه (multisig، events، مراقبة) | admin بصلاحيات أقل، أو من غير admin | من غير admin مفيش طريقة نصلّح مفتاح مسروق؛ الحل نراقبه مش نشيله | لازم multisig قبل أي نشر حقيقي | `docs/decisions/0005-platform-admin-trust.md` |
| Merkle batch بدل tx لكل شهادة | tx لكل طالب | التكلفة ثابتة (حوالي 53.76k gas) مهما كان العدد | الـ revoke محتاج proof وتكلفته بتزيد مع log2(N) | ARCHITECTURE 10.2 |

## 5. الأداء
القياسات على Hardhat network (شبكة Ethereum محلية للاختبار)، optimizer 200 runs، evm cancun. الـ gas هو وحدة قياس تكلفة التنفيذ على Ethereum.

| الـ budget (من ARCHITECTURE 10.1) | المطلوب | المتقاس | اتقاس إزاي (الأمر) |
|---|---|---|---|
| `anchorBatch` gas | ≤ 55,000 مهما كان الحجم | حوالي 53.76k عند 1 و1000 شهادة (الـ test بيغطي الحجمين دول بس)، وعند 10,000 قياس الـ performance-reviewer بـ script في الـ scratchpad (53,762) | `npm test -w @not/contracts` (assertion في الـ test) |
| `revoke` gas | ≤ 70,000 | 57,992 عند شهادة واحدة؛ عند 10,000 شهادة بأسوأ proof (14 hash) قاسه الـ performance-reviewer 68,496، وARCHITECTURE فيها 68,530. الفرق 34 gas بسبب calldata (البايت اللي مش صفر بـ 16 gas والصفر بـ 4). الهامش تحت الـ budget حوالي 2% | الـ test بيأكد بس إن القيمة أقل من 70,000 (`8f207e1b`). أرقام 68,496 و68,530 من scripts قياس مش متسجلة في الـ repo |
| `revokeBatch` gas | ثابت | حوالي 51.9k (51,934 في الـ gas reporter) | مفيش assertion، من تشغيل `REPORT_GAS=true npx hardhat test` بمعرفة الـ performance-reviewer |
| `verify` | `view` مجاني | 34,262 (eth_estimateGas) عند 1، وحوالي 44.0k لـ 44.8k عند 10,000 | قياس الـ performance-reviewer بـ eth_estimateGas على Hardhat، script مؤقت مش متسجل في الـ repo، ومفيش assertion |
| النشر | مفيش budget | 1,313,847 gas | قياس الـ performance-reviewer (gas reporter)، مفيش assertion |
| API و Worker و Web | في الجدول | not measured (مفيش API ولا فرونت لسه) | |

تقدير (مش قياس مباشر): `revoke` بيزيد حوالي 750 gas لكل hash زيادة في الـ proof، والـ proof بيزيد hash واحد كل ما الدفعة تتضاعف. الرقم ده طالع من مقارنة قياسات الـ performance-reviewer عند أحجام مختلفة.

**تحسينات اتعملت:** مفيش تحسين أداء مبني على قياس "قبل وبعد". budget الـ `anchorBatch` (≤ 55,000) و`revoke` (≤ 70,000) اتثبتوا كـ assertions في الـ tests (`c118b0e3`، `8f207e1b`)، فأي تغيير يعدي أي واحد فيهم هيكسر CI. أما `revokeBatch` و`verify` والنشر فمفيش عليهم assertions.

## 6. الأمان والعزل
- **عزل الجامعات على العقد:** tests بتثبت إن جامعة متقدرش تلغي دفعة جامعة تانية، إن hash منسوخ في دفعة جامعة تانية ميلغيش الأصلي، إن `revokeBatch` لجامعة A ميلمسش دفعة B بنفس الـ root، إن تعليق جامعة أو شيل موقّعها ميأثرش على التانية، وإن front-running بنفس الـ root ميحجزش ولا يخطف دفعة الجامعة الأصلية.
- **اختبارات الصلاحيات والنطاق (scope):** الموقّع ميقدرش يستخدم دوال الـ admin؛ الـ admin مش موقّع وميقدرش يعمل anchor؛ موقّع مسروق ميقدرش يعمل `revokeBatch`؛ محفظة اتشالت متقدرش تعمل anchor ولا revoke؛ محفظة اتنقلت من A لـ B بتوقّع لـ B بس ومتقدرش تلغي دفعات A القديمة. الـ admin يتنقل لعنوان جديد (زي multisig) والقديم يفقد السيطرة.
- **التحقق مبيقفش أبدًا:** `verify` شغال وقت الـ pause وبعد تعليق الجامعة (الشهادات القديمة VALID مع `institutionActive=false`).
- **Integration:** hashes اتبنت بـ credential-core off-chain واتحققت on-chain كـ VALID.
- **مفيش بيانات شخصية on-chain:** بس roots وhashes وعناوين وtimestamps وreason codes.
- **عدد الـ tests:** credential-core 11 passed، contracts 33 passing. اختبارات T1 لـ T5 اللي طلبتها المراجعة ضمنهم.
- **الفيتشر لو وقعت:** مفيش plugins في المرحلة دي.

## 7. نقاط التوسيع (extension points)
مفيش extension point اتضاف رسميًا. اللي يمهد لده: الـ events (`BatchAnchored`، `SignerAdded`، `SignerRemoved`، `BatchRevoked`، `CredentialRevoked` وغيرهم) هي الواجهة اللي الـ listener هيبني منها القوايم وينبّه. العقد مش upgradeable، فأي توسيع بيحصل off-chain أو في عقد جديد.

## 8. تتعلم إيه من المرحلة دي
- **Merkle tree و Merkle proof:** شجرة hashes بتختصر آلاف الشهادات في root واحد، والـ proof بطول حوالي log2(N) بيثبت إن عنصر جواها. في `packages/credential-core/src/merkle-batch.ts` و`verify` في `packages/contracts/contracts/CredentialRegistry.sol`. التوثيق: https://docs.openzeppelin.com/contracts/5.x/api/utils و https://github.com/OpenZeppelin/merkle-tree
- **Canonical JSON:** نفس البيانات لازم تطلع نفس النص بالظبط قبل الـ hash، وإلا الـ hash يتغير. في `packages/credential-core/src/canonical-json.ts`. التوثيق: https://www.rfc-editor.org/rfc/rfc8785
- **Salted hash:** الـ salt بيمنع إن حد يخمّن البيانات ويقارن hashes. في `packages/credential-core/src/credential-hash.ts`. التوثيق: https://docs.ethers.org/v6/api/hashing/
- **AccessControl والأدوار:** `onlyRole(DEFAULT_ADMIN_ROLE)` بدل فحص يدوي للعناوين. في `packages/contracts/contracts/CredentialRegistry.sol`. التوثيق: https://docs.openzeppelin.com/contracts/5.x/access-control
- **Pausable:** زرار طوارئ بيوقف الكتابة من غير ما يوقف القراءة. في `pause` و`unpause` في نفس العقد. التوثيق: https://docs.openzeppelin.com/contracts/5.x/api/utils
- **Storage packing و custom errors:** حشر الـ struct في slot واحد بيقلل الـ gas، وcustom errors أرخص من revert strings. في struct `Batch` في العقد. التوثيق: https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html و https://docs.soliditylang.org/en/latest/contracts.html#errors-and-the-revert-statement
- **Front-running:** أي tx في الـ mempool مكشوف، فمتصممش حاجة بمنطق "أول واحد يحجز". الحل في ADR 0001. التوثيق: https://ethereum.org/en/developers/docs/mev/
- **Hardhat tests وقياس الـ gas:** `receipt.gasUsed` في `packages/contracts/test/CredentialRegistry.test.js`. التوثيق: https://hardhat.org/hardhat-runner/docs/guides/test-contracts

## 9. حاجات مش مثالية (tech debt) ومتابعات
- **الـ gas reporter مش في CI.** الـ budgets متثبتة كـ assertions بس، ومفيش تقرير gas على كل PR، مع إن ARCHITECTURE 10.2 بتقول إن الجدول بيتطبع في CI وده لسه متعملش (`hardhat-gas-reporter` مش متظبط في `hardhat.config.js`). ROADMAP Phase 2 فيها "gas budget assertions" تحت Performance tooling، بس مفيهاش الـ gas reporter بالاسم.
- **هامش `revoke` حوالي 2% بس.** عند 10,000 شهادة القيمة المقاسة 68,496 والـ budget 70,000، وكل hash زيادة تقديرياً بحوالي 750 gas، يعني تقديراً (مش قياس) فوق حوالي 32k شهادة (proof بطول 15 أو أكتر) هنقرب أو نعدي. محتاجين ADR يا إما يحدد أقصى حجم للدفعة يا إما يغير الـ budget بقياس، قبل ما أي دفعة تعدي حوالي 32k.
- **تنبيهات الـ listener:** لازم تنبيه على `SignerAdded` و`SignerRemoved` و`BatchRevoked`، وعلى أي `BatchAnchored` ملهوش batch متجهز في الـ DB (علامة على مفتاح مسروق). Phase 2 و4.
- **صفحة التحقق** لازم تعرض محفظة الموقّع وإمتى اتضافت، عشان اللي بيتحقق يشوف لو الدفعة اتوقّعت بمحفظة غريبة.
- **الـ admin على Sepolia محفظة واحدة مش multisig.** مقبول لشبكة اختبار، بس قبل أي نشر حقيقي لازم يتنقل لـ multisig (ADR 0005).
- **test الـ revoke gas بطيء:** بيبني tree بـ 10,000 ورقة وبياخد حوالي 15 لـ 20 ثانية.
- **reason codes أكبر من 5 مقبولة on-chain.** العقد بيرفض 0 بس. الـ API لازم يتحقق منها.
- **إخفاء الـ RPC URL في سكريبت النشر** بيمسك النص الحرفي للـ URL بس؛ لو ظهر بصيغة تانية (مثلًا encoded) مش هيتشال.
- **تحذيرات line endings في git** (CRLF وLF على Windows). غالبًا محتاجين `.gitattributes`.
- **مفتاح النشر:** نشر Sepolia استخدم مفتاح محفظة المستخدم الشخصية (Account 1) من `packages/contracts/.env`. التوصية: محفظة مخصصة للنشر بعد كده، وشيل المفتاح من `.env` بعد الاستخدام. (`.env` مش متتبع في git.)

## ملاحظة على طريقة الشغل
الشغل مشي بـ `implementer` بيكتب الكود و4 reviewers (spec، tenant isolation، performance، comment police) بيراجعوا من غير ما يعدلوا. المراجعين مسكوا مشاكل حقيقية قبل النشر: front-running على الـ root، تغيير المحفظة، الـ admin اللي كان هيبقى الـ deployer تلقائيًا، موقّع مسروق يقدر يلغي دفعات كاملة، وثغرات سكريبت النشر. ده اللي خلى العقد يتعاد تصميمه (`b3a1fcd9` اتبدل بـ `35df03de`) وخمس ADRs اتكتبوا قبل النشر مش بعده. والـ comment police شال تعليقات زيادة في كذا commit (`67b65e1f`، `46a46452`، `9a019b2b`).

## 10. جرّب بنفسك
```bash
npm ci                                      # تسطيب كل الـ workspaces
npm test                                    # build وكل الـ tests (11 و33)
npm test -w @not/credential-core
npm test -w @not/contracts                  # فيه الـ gas assertions
cd packages/contracts && npx hardhat node   # chain محلي على :8545 (في terminal لوحده)
npm run deploy:local -w @not/contracts      # نشر على الـ chain المحلي (من الـ root في terminal تاني)
```
العقد على Sepolia: `0x5ea33609e04C42f2C825EBf8D3Dc8F70B41Dbb5C` (chainId 11155111، block 11970368، tx `0x94e1aef2a7829d9ff37048e82bfc32fce9773577e3f196237c2c89bdcb31b115`). تقدر تفتحه على https://sepolia.etherscan.io/address/0x5ea33609e04C42f2C825EBf8D3Dc8F70B41Dbb5C
