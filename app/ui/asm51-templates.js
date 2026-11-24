// 8051 assembly programs in the style of the VTU Microcontroller lab (Part A).
// setup: values placed in memory before running; check(cpu) → true when the result is correct (used by tests).
const x = (cpu, a) => cpu.xram[a], i = (cpu, a) => cpu.iram[a];
export const ASM_TEMPLATES = {
  blockmove: { name: '1 · Block move (external memory)', setup: { xram: { 0x8000: [0x11, 0x22, 0x33, 0x44, 0x55] } }, view: { xram: [0x8000, 0x9000] },
    about: 'Copy 5 bytes from external RAM 8000H to 9000H using MOVX and two pointers (DPTR switched with saved registers).',
    src: `; Block move: copy N bytes from 8000H to 9000H
        ORG 0000H
        MOV  R2, #05H        ; number of bytes
        MOV  R0, #00H        ; source low byte   (source 80xxH)
        MOV  R1, #00H        ; dest   low byte   (dest   90xxH)
NEXT:   MOV  DPH, #80H
        MOV  DPL, R0
        MOVX A, @DPTR        ; read source
        MOV  DPH, #90H
        MOV  DPL, R1
        MOVX @DPTR, A        ; write destination
        INC  R0
        INC  R1
        DJNZ R2, NEXT
HERE:   SJMP HERE
        END`, check: c => [0, 1, 2, 3, 4].every(k => x(c, 0x9000 + k) === x(c, 0x8000 + k)) },
  exchange: { name: '2 · Block exchange (internal memory)', setup: { iram: { 0x30: [1, 2, 3, 4], 0x40: [0xA, 0xB, 0xC, 0xD] } }, view: { iram: [0x30, 0x40] },
    about: 'Swap 4 bytes at 30H with 4 bytes at 40H using indirect addressing (@R0, @R1) and XCH.',
    src: `; Exchange two blocks of 4 bytes: 30H..33H <-> 40H..43H
        ORG 0000H
        MOV  R0, #30H
        MOV  R1, #40H
        MOV  R2, #04H
LOOP:   MOV  A, @R0
        XCH  A, @R1
        MOV  @R0, A
        INC  R0
        INC  R1
        DJNZ R2, LOOP
HERE:   SJMP HERE
        END`, check: c => [0, 1, 2, 3].every(k => i(c, 0x30 + k) === 0xA + k && i(c, 0x40 + k) === 1 + k) },
  sort: { name: '3 · Sort ascending (bubble sort)', setup: { iram: { 0x40: [0x25, 0x05, 0x99, 0x12, 0x47] } }, view: { iram: [0x40] },
    about: 'Bubble sort 5 numbers at 40H in ascending order. SUBB (next − current) sets the carry when the pair is out of order, then the two bytes are swapped.',
    src: `; Ascending sort of 5 bytes at 40H
        ORG 0000H
        MOV  R3, #04H        ; passes = N - 1
PASS:   MOV  R0, #40H
        MOV  R2, #04H        ; compares per pass
CMP:    MOV  A, @R0
        MOV  R1, A           ; R1 = current
        INC  R0
        MOV  A, @R0          ; A  = next
        CLR  C
        SUBB A, R1           ; next - current
        JNC  NOSWAP          ; already in order
        MOV  A, @R0          ; swap
        XCH  A, R1
        MOV  @R0, A
        DEC  R0
        MOV  A, R1
        MOV  @R0, A
        INC  R0
NOSWAP: DJNZ R2, CMP
        DJNZ R3, PASS
HERE:   SJMP HERE
        END`, check: c => JSON.stringify([...c.iram.slice(0x40, 0x45)]) === JSON.stringify([0x05, 0x12, 0x25, 0x47, 0x99]) },
  largest: { name: '4 · Largest number in an array', setup: { iram: { 0x40: [0x25, 0x8F, 0x14, 0x77, 0x3C] } }, view: { iram: [0x40, 0x50] },
    about: 'Find the largest of 5 numbers at 40H and store it at 50H.',
    src: `; Largest of 5 numbers at 40H -> 50H
        ORG 0000H
        MOV  R0, #40H
        MOV  R2, #04H
        MOV  A, @R0          ; first number is the largest so far
LOOP:   INC  R0
        MOV  B, @R0
        CJNE A, B, DIFF      ; sets C when A < B
DIFF:   JNC  KEEP
        MOV  A, B            ; new largest
KEEP:   DJNZ R2, LOOP
        MOV  50H, A
HERE:   SJMP HERE
        END`, check: c => i(c, 0x50) === 0x8F },
  add16: { name: '5 · 16-bit addition', setup: { iram: { 0x40: [0x34, 0x12, 0xCD, 0xAB] } }, view: { iram: [0x40, 0x50] },
    about: 'Add 1234H + ABCDH. Low bytes with ADD, high bytes with ADDC (adds the carry). Result BE01H at 50H/51H, carry at 52H.',
    src: `; 16-bit add: (41H:40H) + (43H:42H) -> (51H:50H), carry -> 52H
        ORG 0000H
        MOV  A, 40H
        ADD  A, 42H
        MOV  50H, A
        MOV  A, 41H
        ADDC A, 43H
        MOV  51H, A
        CLR  A
        RLC  A               ; carry into A
        MOV  52H, A
HERE:   SJMP HERE
        END`, check: c => i(c, 0x50) === 0x01 && i(c, 0x51) === 0xBE && i(c, 0x52) === 0 },
  sub16: { name: '6 · 16-bit subtraction', setup: { iram: { 0x40: [0x00, 0x50, 0x01, 0x20] } }, view: { iram: [0x40, 0x50] },
    about: 'Subtract 2001H from 5000H with SUBB (subtracts the borrow). Result 2FFFH.',
    src: `; 16-bit subtract: (41H:40H) - (43H:42H) -> (51H:50H)
        ORG 0000H
        CLR  C
        MOV  A, 40H
        SUBB A, 42H
        MOV  50H, A
        MOV  A, 41H
        SUBB A, 43H
        MOV  51H, A
HERE:   SJMP HERE
        END`, check: c => i(c, 0x50) === 0xFF && i(c, 0x51) === 0x2F },
  muldiv: { name: '7 · Multiply and divide (8-bit)', setup: { iram: { 0x40: [0xFF, 0x0A] } }, view: { iram: [0x40, 0x50] },
    about: 'MUL AB: FFH × 0AH = 09F6H (A = low, B = high). DIV AB: FFH ÷ 0AH = 19H remainder 05H.',
    src: `; Multiply and divide 8-bit numbers at 40H and 41H
        ORG 0000H
        MOV  A, 40H
        MOV  B, 41H
        MUL  AB
        MOV  50H, A          ; product low
        MOV  51H, B          ; product high
        MOV  A, 40H
        MOV  B, 41H
        DIV  AB
        MOV  52H, A          ; quotient
        MOV  53H, B          ; remainder
HERE:   SJMP HERE
        END`, check: c => i(c, 0x50) === 0xF6 && i(c, 0x51) === 0x09 && i(c, 0x52) === 0x19 && i(c, 0x53) === 0x05 },
  square: { name: '8 · Square and cube of a number', setup: { iram: { 0x40: [0x05] } }, view: { iram: [0x40, 0x50] },
    about: 'Square = n × n, cube = n × n × n using MUL AB. 5² = 25 (19H), 5³ = 125 (7DH).',
    src: `; Square and cube of the byte at 40H
        ORG 0000H
        MOV  A, 40H
        MOV  B, A
        MUL  AB
        MOV  50H, A          ; square
        MOV  B, 40H
        MUL  AB
        MOV  51H, A          ; cube (low byte)
        MOV  52H, B          ; cube (high byte)
HERE:   SJMP HERE
        END`, check: c => i(c, 0x50) === 25 && i(c, 0x51) === 125 && i(c, 0x52) === 0 },
  bcdcount: { name: '9 · BCD up counter 00–99 (with delay)', setup: {}, view: { iram: [0x30], ports: true },
    about: 'Counts 00 to 99 in BCD on port P1 using ADD + DA A (decimal adjust). The delay uses nested DJNZ loops. Watch P1 and A change.',
    src: `; BCD up counter on P1 (stops after 99)
        ORG 0000H
        MOV  A, #00H
UP:     MOV  P1, A
        MOV  30H, A
        ACALL DELAY
        ADD  A, #01H
        DA   A               ; keep it in BCD
        JNZ  UP              ; after 99 the BCD sum wraps to 00
HERE:   SJMP HERE
DELAY:  MOV  R1, #02H
D1:     MOV  R2, #0FFH
D2:     DJNZ R2, D2
        DJNZ R1, D1
        RET
        END`, check: c => i(c, 0x30) === 0x99 },
  hexascii: { name: '10 · Hex to ASCII conversion', setup: { iram: { 0x40: [0x3A] } }, view: { iram: [0x40, 0x50] },
    about: 'Converts each nibble of 3AH to its ASCII character: "3" (33H) and "A" (41H). Digits add 30H, letters add 37H.',
    src: `; Hex byte at 40H -> two ASCII characters at 50H (high) and 51H (low)
        ORG 0000H
        MOV  A, 40H
        SWAP A
        ACALL CONV
        MOV  50H, A
        MOV  A, 40H
        ACALL CONV
        MOV  51H, A
HERE:   SJMP HERE
CONV:   ANL  A, #0FH
        CJNE A, #0AH, CHK
CHK:    JC   DIGIT
        ADD  A, #07H
DIGIT:  ADD  A, #30H
        RET
        END`, check: c => i(c, 0x50) === 0x33 && i(c, 0x51) === 0x41 },
  ones: { name: '11 · Count ones and zeros in a byte', setup: { iram: { 0x40: [0xA7] } }, view: { iram: [0x40, 0x50] },
    about: 'Rotate the byte through the carry 8 times and count the 1s and 0s. A7H = 1010 0111 has five 1s and three 0s.',
    src: `; Count 1s and 0s of the byte at 40H -> 50H (ones), 51H (zeros)
        ORG 0000H
        MOV  A, 40H
        MOV  R2, #08H
        MOV  50H, #00H
        MOV  51H, #00H
LOOP:   RLC  A
        JNC  ZERO
        INC  50H
        SJMP NEXT
ZERO:   INC  51H
NEXT:   DJNZ R2, LOOP
HERE:   SJMP HERE
        END`, check: c => i(c, 0x50) === 5 && i(c, 0x51) === 3 },
  timerdelay: { name: '12 · Timer 0 delay (mode 1) toggling P1.0', setup: {}, view: { ports: true, iram: [0x30] },
    about: 'Timer 0 in mode 1 (16-bit) counts machine cycles. Loading TH0:TL0 = 4C00H gives 46 080 counts ≈ 50 ms at 11.0592 MHz. P1.0 toggles every overflow; 30H counts the toggles.',
    src: `; Square wave on P1.0 using Timer 0, mode 1
        ORG 0000H
        MOV  TMOD, #01H      ; timer 0, mode 1
        MOV  30H, #00H
AGAIN:  MOV  TH0, #4CH
        MOV  TL0, #00H
        SETB TR0             ; start
WAIT:   JNB  TF0, WAIT       ; wait for overflow
        CLR  TR0
        CLR  TF0
        CPL  P1.0
        INC  30H
        MOV  A, 30H
        CJNE A, #04H, AGAIN
HERE:   SJMP HERE
        END`, check: c => i(c, 0x30) === 4 && Math.abs(c.time - 4 * 0.05) < 0.005 },
  serial: { name: '13 · Serial transmit "VTU" at 9600 baud', setup: {}, view: { serial: true },
    about: 'Timer 1 in mode 2 with TH1 = FDH gives 9600 baud at 11.0592 MHz. Each character is written to SBUF; TI goes high when it has been sent.',
    src: `; Send "VTU" on the serial port at 9600 baud
        ORG 0000H
        MOV  TMOD, #20H      ; timer 1, mode 2 (auto reload)
        MOV  TH1, #0FDH      ; 9600 baud
        MOV  SCON, #50H      ; mode 1, receive enabled
        SETB TR1
        MOV  DPTR, #MSG
NEXT:   CLR  A
        MOVC A, @A+DPTR
        JZ   DONE
        MOV  SBUF, A
WAIT:   JNB  TI, WAIT
        CLR  TI
        INC  DPTR
        SJMP NEXT
DONE:   SJMP DONE
MSG:    DB   "VTU", 0
        END`, check: (c, out) => out === 'VTU' },
};
