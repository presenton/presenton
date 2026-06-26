import * as z from "zod";

export const slideLayoutId = "evaluation-matrix-slide";
export const slideLayoutName = "Evaluation Matrix Slide";
export const slideLayoutDescription =
  "A title and subtitle layout with a compact matrix of criteria rows and level columns.";

const RubricCriterionSchema = z.object({
  criterion: z.string().min(4).max(24).meta({
    description: "Criterion or row label for the matrix.",
  }),
  beginner: z.string().min(8).max(60).meta({
    description: "Description for the first level column.",
  }),
  developing: z.string().min(8).max(60).meta({
    description: "Description for the second level column.",
  }),
  proficient: z.string().min(8).max(60).meta({
    description: "Description for the third level column.",
  }),
  advanced: z.string().min(8).max(60).meta({
    description: "Description for the advanced level column.",
  }),
});

const DEFAULT_CRITERIA = [
  {
    criterion: "Research",
    beginner: "Uses limited or unclear sources.",
    developing: "Uses some relevant sources.",
    proficient: "Uses reliable evidence clearly.",
    advanced: "Synthesizes strong evidence deeply.",
  },
  {
    criterion: "Analysis",
    beginner: "Mostly describes information.",
    developing: "Shows basic reasoning.",
    proficient: "Explains patterns and causes.",
    advanced: "Develops original insight.",
  },
  {
    criterion: "Presentation",
    beginner: "Message is hard to follow.",
    developing: "Basic structure is present.",
    proficient: "Ideas are clear and organized.",
    advanced: "Delivery is polished and persuasive.",
  },
];

const LEVELS = [
  { key: "beginner", label: "1 - Beginner" },
  { key: "developing", label: "2 - Developing" },
  { key: "proficient", label: "3 - Proficient" },
  { key: "advanced", label: "4 - Advanced" },
] as const;

export const Schema = z.object({
  title: z.string().min(6).max(32).default("Evaluation Matrix").meta({
    description: "Main slide title.",
  }),
  subtitle: z
    .string()
    .min(20)
    .max(130)
    .default(
      "A compact matrix for comparing criteria across defined levels."
    )
    .meta({
      description: "Short description shown below the title.",
    }),
  criteria: z
    .array(RubricCriterionSchema)
    .min(3)
    .max(5)
    .default(DEFAULT_CRITERIA)
    .meta({
      description: "Matrix rows evaluated across the level columns.",
    }),
});

export type SchemaType = z.infer<typeof Schema>;

function getCriteria(
  criteria?: Array<Partial<SchemaType["criteria"][number]>>
) {
  const source = criteria?.length ? criteria : DEFAULT_CRITERIA;

  return source.slice(0, 5).map((criterion, index) => ({
    ...DEFAULT_CRITERIA[index % DEFAULT_CRITERIA.length],
    ...criterion,
  }));
}

const EducationAssessmentRubricSlide = ({
  data,
}: {
  data: Partial<SchemaType>;
}) => {
  const criteria = getCriteria(data.criteria);
  const compact = criteria.length >= 5;
  const title = data.title || "Evaluation Matrix";
  const subtitle =
    data.subtitle ||
    "A compact matrix for comparing criteria across defined levels.";

  return (
    <>
      <link
        href="https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap"
        rel="stylesheet"
      />
      <div
        className="relative h-[720px] w-[1280px] overflow-hidden px-[48px] py-[44px]"
        style={{
          backgroundColor: "var(--background-color,#efeff1)",
          fontFamily: "var(--body-font-family,'Source Serif 4')",
        }}
      >
        <h2
          className="font-serif text-[58px] font-medium leading-[96%] tracking-[-0.02em]"
          style={{ color: "var(--primary-color,#1a1752)" }}
        >
          {title}
        </h2>
        <p
          className="mt-[12px] max-w-[980px] text-[21px] leading-[1.24]"
          style={{ color: "var(--background-text,#3a3d4c)" }}
        >
          {subtitle}
        </p>

        <div
          className="mt-[26px] overflow-hidden rounded-[18px] border"
          style={{ borderColor: "var(--stroke,#d8d8dd)" }}
        >
          <div
            className="grid border-b"
            style={{
              backgroundColor: "var(--primary-color,#272272)",
              borderColor: "var(--stroke,#d8d8dd)",
              color: "var(--primary-text,#ffffff)",
              gridTemplateColumns: "1.14fr repeat(4, minmax(0, 1fr))",
            }}
          >
            <div className="px-[18px] py-[13px] text-[18px] font-semibold leading-none">
              Criteria
            </div>
            {LEVELS.map((level) => (
              <div
                key={level.key}
                className="border-l px-[14px] py-[13px] text-[17px] font-semibold leading-none"
                style={{ borderColor: "rgba(255,255,255,0.22)" }}
              >
                {level.label}
              </div>
            ))}
          </div>

          {criteria.map((criterion, rowIndex) => (
            <div
              key={`${criterion.criterion}-${rowIndex}`}
              className="grid border-b last:border-b-0"
              style={{
                backgroundColor:
                  rowIndex % 2 === 0
                    ? "var(--card-color,#FFFFFF80)"
                    : "var(--card-color,#f1efef)",
                borderColor: "var(--stroke,#d8d8dd)",
                gridTemplateColumns: "1.14fr repeat(4, minmax(0, 1fr))",
                minHeight: compact ? "86px" : "104px",
              }}
            >
              <div
                className="flex items-center px-[18px] py-[12px] text-[19px] font-semibold leading-[1.14]"
                style={{ color: "var(--primary-color,#1a1752)" }}
              >
                {criterion.criterion}
              </div>
              {LEVELS.map((level) => (
                <div
                  key={level.key}
                  className="flex items-center border-l px-[14px] py-[10px]"
                  style={{ borderColor: "var(--stroke,#d8d8dd)" }}
                >
                  <p
                    className="leading-[1.14]"
                    style={{
                      color: "var(--background-text,#34394c)",
                      fontSize: "16px",
                    }}
                  >
                    {criterion[level.key]}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default EducationAssessmentRubricSlide;
