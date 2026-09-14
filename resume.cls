\NeedsTeXFormat{LaTeX2e}[2020-10-01]
\ProvidesClass{resume}[2026/09/06 Compact resume template]

% Pass options such as a4paper or 11pt from \documentclass to article.
\DeclareOption*{\PassOptionsToClass{\CurrentOption}{article}}
\ProcessOptions\relax
\LoadClass{article}

% Page margins: change the four geometry values below.
\RequirePackage[left=0.5in,top=0.5in,right=0.5in,bottom=0.5in]{geometry}
\RequirePackage{xcolor}
\RequirePackage{fontspec}
\RequirePackage{titlesec}
\RequirePackage{enumitem}
\RequirePackage{etoolbox}
\RequirePackage{needspace}
\RequirePackage[normalem]{ulem}
\RequirePackage{hyperref}

\pagestyle{empty}
\raggedbottom

% Font: replace the four OpenType filenames below; compile with XeLaTeX.
\setmainfont{lmroman10-regular.otf}[
  BoldFont=lmroman10-bold.otf,
  ItalicFont=lmroman10-italic.otf,
  BoldItalicFont=lmroman10-bolditalic.otf
]

% Colors: namecolor controls resume text and headings; linkblue controls links.
\definecolor{namecolor}{HTML}{293E49}
\definecolor{linkblue}{HTML}{003B73}

% Link colors and default PDF metadata; each resume can override its title and subject.
\hypersetup{
  colorlinks=true,
  urlcolor=linkblue,
  linkcolor=linkblue,
  pdftitle={LaTeX Resume Template},
  pdfauthor={},
  pdfsubject={Software engineering resume template},
  pdfkeywords={resume, curriculum vitae, LaTeX, template},
  pdfcreator={XeLaTeX},
  pdfproducer={}
}
\urlstyle{same}

% Link styling: replace \uline{#2} with #2 to remove underlining.
\newcommand{\resumelink}[2]{\href{#1}{\uline{#2}}}

% Automatic reminders for the template's sample values and [bracketed prompts].
% Inspect only content passed to the resume commands below, without expanding
% user macros or printing their values in the log. TeX has already removed comments.
\ExplSyntaxOn
\tl_new:N \l__resume_check_tl
\bool_new:N \l__resume_placeholder_bool
\cs_new_protected:Npn \__resume_match:n #1
  {
    \exp_args:NnV \regex_match:nnT {#1} \l__resume_check_tl
      { \bool_set_true:N \l__resume_placeholder_bool }
  }
\cs_new_protected:Npn \resumecheckfield #1#2#3
  {
    \tl_set:Nx \l__resume_check_tl { \tl_to_str:n {#3} }
    % This separator has no arguments: a following [Phone] is visible content.
    \regex_replace_all:nnN { \\ contactsep \s+ } { } \l__resume_check_tl
    % Ignore optional command arguments such as \item[label] or \\[3pt].
    \regex_replace_all:nnN
      { \\ ( [A-Za-z@]+ \s* \*? | \\ ) ( \s* \[ [^\[\]]* \] )+ }
      { } \l__resume_check_tl
    \bool_set_false:N \l__resume_placeholder_bool
    \__resume_match:n { \[ [^\[\]]* \] }
    \str_case:nn {#2}
      {
        {name}{ \__resume_match:n { \A \s* Your \s+ Name \s* \Z } }
        {contact}{
          \__resume_match:n
            { hello@example\.com | your-handle | tel:\+15555555555 |
              \+1 \s* \(555\) \s* 555-5555 | City,? \s+ Region }
        }
        {role}{ \__resume_match:n { \A \s* Issuing \s+ Organization \s* \Z } }
        {organization}{
          \__resume_match:n
            { \A \s* ( Company \s+ [A-E] | Company \s+ Name |
              Organization \s+ Name | Project \s+ Name | Certification \s+ Name |
              Professional \s+ Certification | Additional \s+ Certification ) \s* \Z }
        }
        {location}{ \__resume_match:n { \A \s* City,? \s+ Region \s* \Z } }
        {dates}{ \__resume_match:n { Month \s+ Year | \A \s* Year \s* \Z } }
      }
    \bool_if:NT \l__resume_placeholder_bool
      {
        \ClassWarning{resume}{Placeholder~reminder~in~#1.\MessageBreak
          Replace~sample~values~and~bracketed~prompts~before~sharing}
      }
  }
\ExplSyntaxOff

\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}

% Header styling: adjust the name size, contact size, and vertical gaps here.
\newcommand{\resumename}[1]{%
  \resumecheckfield{resume name}{name}{#1}%
  \noindent{\fontsize{30}{36}\selectfont\color{namecolor}\textbf{#1}}\par
  \vspace{6pt}%
}

\newcommand{\contactsep}{\enspace\ensuremath{\diamond}\enspace}

\newcommand{\resumecontact}[1]{%
  \resumecheckfield{contact details}{contact}{#1}%
  {\small\color{namecolor}#1}\par
  \vspace{8pt}{\color{black!60}\hrule height 0.5pt}%
}

% Section styling: adjust heading typography, divider, and spacing below.
\titleformat{\section}
  {\large\bfseries\color{namecolor}}
  {}{0pt}{}
  [\vspace{6pt}{\color{black!60}\hrule height 0.5pt}]

\titlespacing*{\section}{0pt}{9pt}{6pt}

\newlength{\jobdutiesvspace}
\newcounter{resumeentry}
\newsavebox{\resumeorganizationbox}
\newsavebox{\resumedatesbox}
\newsavebox{\resumeheadingbox}
\newlength{\resumedateswidth}
\newlength{\resumeorganizationwidth}
\newlength{\resumeentryspace}

% Keep the original single-line layout when it fits. Otherwise, wrap the
% organization/location beside dates. Dates use at most 40% of the line;
% a 1em gap separates the columns. No font sizes or margins are reduced.
\newcommand{\resumeentryheading}[3]{%
  \sbox{\resumeorganizationbox}{\color{namecolor}\textbf{#1}\ifblank{#2}{}{\space--\space#2}}%
  \sbox{\resumedatesbox}{\small\textbf{\color{namecolor}#3}}%
  \ifdim\dimexpr\wd\resumeorganizationbox+\wd\resumedatesbox+2\tabcolsep\relax>\linewidth
    \setlength{\resumedateswidth}{\wd\resumedatesbox}%
    \ifdim\resumedateswidth>0.4\linewidth
      \setlength{\resumedateswidth}{0.4\linewidth}%
    \fi
    \setlength{\resumeorganizationwidth}{\dimexpr\linewidth-\resumedateswidth-1em\relax}%
    \sbox{\resumeheadingbox}{%
      \begin{tabular}{@{}p{\resumeorganizationwidth}@{\hspace{1em}}p{\resumedateswidth}@{}}
        \raggedright\leavevmode{\color{namecolor}\textbf{#1}\ifblank{#2}{}{\space--\space#2}} &
        \raggedleft\small\leavevmode\textbf{\color{namecolor}#3}\tabularnewline
      \end{tabular}%
    }%
  \else
    \sbox{\resumeheadingbox}{%
      \begin{tabular*}{\linewidth}{@{}l@{\extracolsep{\fill}}r@{}}
        \usebox{\resumeorganizationbox} & \usebox{\resumedatesbox}
      \end{tabular*}%
    }%
  \fi
  % Reserve space for wrapped headings and the role that follows them.
  \setlength{\resumeentryspace}{\dimexpr\ht\resumeheadingbox+\dp\resumeheadingbox+3\baselineskip\relax}%
  \ifdim\resumeentryspace<5\baselineskip
    \setlength{\resumeentryspace}{5\baselineskip}%
  \fi
  \Needspace{\resumeentryspace}%
  \vspace{8pt}%
  \noindent\usebox{\resumeheadingbox}\par\nopagebreak%
}

% \jobentry[Optional summary]{Title}{Company}{Location}{Dates}
% Pass {} for Location to omit it.
% The gap before jobduties is 5pt with a summary and 3pt without.
\newcommand{\jobentry}[5][]{%
  \stepcounter{resumeentry}%
  \resumecheckfield{entry \arabic{resumeentry} summary}{summary}{#1}%
  \resumecheckfield{entry \arabic{resumeentry} role}{role}{#2}%
  \resumecheckfield{entry \arabic{resumeentry} organization}{organization}{#3}%
  \resumecheckfield{entry \arabic{resumeentry} location}{location}{#4}%
  \resumecheckfield{entry \arabic{resumeentry} dates}{dates}{#5}%
  \ifblank{#1}{\setlength{\jobdutiesvspace}{3pt}}{\setlength{\jobdutiesvspace}{5pt}}%
  \resumeentryheading{#3}{#4}{#5}%
  \vspace{1pt}%
  {\color{namecolor}\textit{#2}}\par\nopagebreak%
  \ifblank{#1}{}{%
    \vspace{4pt}%
    {\small\itshape\color{namecolor}#1\/}\par\nopagebreak%
  }%
  \par\nopagebreak%
}

% Entry bullets: adjust line spacing, marker, indentation, and list spacing here.
\NewDocumentEnvironment{jobduties}{+b}{%
  \resumecheckfield{entry \arabic{resumeentry} bullets}{bullets}{#1}%
  \vspace{\jobdutiesvspace}%
  \color{namecolor}\normalfont%
  \linespread{1.06}\selectfont%
  \begin{itemize}[
    leftmargin=*,
    label=\textbullet,
    topsep=2pt,
    itemsep=2pt,
    parsep=0pt,
    partopsep=0pt
  ]
  #1%
  \end{itemize}
  \vspace{4pt}%
}{}

% Skills bullets: change these values if skills should use a different list style.
\NewDocumentEnvironment{skillitems}{+b}{%
  \resumecheckfield{skills bullets}{bullets}{#1}%
  \vspace{8pt}%
  \color{namecolor}\normalfont%
  \linespread{1.06}\selectfont%
  \begin{itemize}[
    leftmargin=*,
    label=\textbullet,
    topsep=2pt,
    itemsep=2pt,
    parsep=0pt,
    partopsep=0pt
  ]
  #1%
  \end{itemize}
  \vspace{4pt}%
}{}
