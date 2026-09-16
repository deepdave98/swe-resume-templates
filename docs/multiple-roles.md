# Multiple roles at one company

Use `\jobentry` for the most recent role, then `\roleentry` for earlier roles at the same employer and location. Each role keeps its own dates and bullets. The company appears once on the page.

Replace every bracketed field. Dates below are role dates, not total company tenure.

```latex
\jobentry{[Most recent title]}{[Company]}{[City]}{[Role start] -- [Role end]}
\begin{jobduties}
  \item Owned [specific responsibility]; made [decision] under [constraint].
  \item Resolved [failure] by [change]; checked it with [evidence].
\end{jobduties}

\roleentry{[Earlier title]}{[Role start] -- [Role end]}
\begin{jobduties}
  \item Built [component] and tested [failure case].
\end{jobduties}
```

Add more `\roleentry` blocks for earlier roles. An optional summary works the same way as `\jobentry`:

```latex
\roleentry[{Moved from [team] to [team]; owned [new scope].}]{[Title]}{[Role start] -- [Role end]}
```

Use your actual titles and dates. Do not give the latest title the dates of your entire tenure. If your responsibilities grew without a title change, keep one entry and explain the change in its bullets.

Long titles and dates wrap. If a role starts on a new page, the class repeats the company and location above it. Bullets can still span pages; inspect the break before sharing.

Use a full `\jobentry` when the employer or location changes, or when starting another section. Calling `\roleentry` before any `\jobentry` prints a warning because it has no employer to inherit.
