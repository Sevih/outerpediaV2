CalcBattlePower file off=0x2C55EE4 len=0x4A4

  0x02C59EE4: sub      sp, sp, #0xd0
  0x02C59EE8: str      d14, [sp, #0x30]
  0x02C59EEC: stp      d13, d12, [sp, #0x40]
  0x02C59EF0: stp      d11, d10, [sp, #0x50]
  0x02C59EF4: stp      d9, d8, [sp, #0x60]
  0x02C59EF8: stp      x29, x30, [sp, #0x70]
  0x02C59EFC: stp      x28, x27, [sp, #0x80]
  0x02C59F00: stp      x26, x25, [sp, #0x90]
  0x02C59F04: stp      x24, x23, [sp, #0xa0]
  0x02C59F08: stp      x22, x21, [sp, #0xb0]
  0x02C59F0C: stp      x20, x19, [sp, #0xc0]
  0x02C59F10: cbz      x0, #0x2c5a384
  0x02C59F14: mov      x29, x1
  0x02C59F18: mov      x1, xzr
  0x02C59F1C: mov      x23, x0
  0x02C59F20: bl       #0x27dfffc
  0x02C59F24: mov      w28, w0
  0x02C59F28: mov      x0, x23
  0x02C59F2C: mov      x1, xzr
  0x02C59F30: bl       #0x27e00d8
  0x02C59F34: str      w0, [sp, #0x38]
  0x02C59F38: mov      x0, x23
  0x02C59F3C: mov      x1, xzr
  0x02C59F40: bl       #0x27dfb20
  0x02C59F44: str      w0, [sp, #0x1c]
  0x02C59F48: mov      x0, x23
  0x02C59F4C: mov      x1, xzr
  0x02C59F50: bl       #0x27dff20
  0x02C59F54: mov      w27, w0
  0x02C59F58: mov      x0, x23
  0x02C59F5C: mov      x1, xzr
  0x02C59F60: bl       #0x27e0290
  0x02C59F64: str      w0, [sp, #0x20]
  0x02C59F68: mov      x0, x23
  0x02C59F6C: mov      x1, xzr
  0x02C59F70: bl       #0x27e036c
  0x02C59F74: mov      w20, w0
  0x02C59F78: mov      x0, x23
  0x02C59F7C: mov      x1, xzr
  0x02C59F80: bl       #0x27e0524
  0x02C59F84: str      w0, [sp, #0x3c]
  0x02C59F88: mov      x0, x23
  0x02C59F8C: mov      x1, xzr
  0x02C59F90: bl       #0x27e0970
  0x02C59F94: str      w0, [sp, #0x18]
  0x02C59F98: mov      x0, x23
  0x02C59F9C: mov      x1, xzr
  0x02C59FA0: bl       #0x27e0a4c
  0x02C59FA4: mov      w19, w0
  0x02C59FA8: mov      x0, x23
  0x02C59FAC: mov      x1, xzr
  0x02C59FB0: bl       #0x27df1b4
  0x02C59FB4: mov      w25, w0
  0x02C59FB8: mov      x0, x23
  0x02C59FBC: mov      x1, xzr
  0x02C59FC0: bl       #0x27df1cc
  0x02C59FC4: mov      w26, w0
  0x02C59FC8: mov      x0, x23
  0x02C59FCC: mov      x1, xzr
  0x02C59FD0: bl       #0x27e1208
  0x02C59FD4: mov      w24, w0
  0x02C59FD8: mov      x0, x23
  0x02C59FDC: mov      x1, xzr
  0x02C59FE0: bl       #0x27e01b4
  0x02C59FE4: mov      w21, w0
  0x02C59FE8: mov      x0, x23
  0x02C59FEC: mov      x1, xzr
  0x02C59FF0: bl       #0x27e12e4
  0x02C59FF4: cbz      x29, #0x2c5a384
  0x02C59FF8: mov      w22, w0
  0x02C59FFC: mov      x0, x29
  0x02C5A000: mov      w1, wzr
  0x02C5A004: mov      x2, xzr
  0x02C5A008: bl       #0x24cefec
  0x02C5A00C: stp      w26, w25, [sp, #0x10]
  0x02C5A010: cbz      x0, #0x2c5a028
  0x02C5A014: mov      x1, xzr
  0x02C5A018: bl       #0x24cf238
  0x02C5A01C: and      w8, w0, #0xff
  0x02C5A020: sub      w8, w8, #4
  0x02C5A024: b        #0x2c5a02c
  0x02C5A028: mov      w8, #-3
  0x02C5A02C: mov      w1, #1
  0x02C5A030: mov      x0, x29
  0x02C5A034: mov      x2, xzr
  0x02C5A038: str      w8, [sp, #0xc]
  0x02C5A03C: mov      w26, #1
  0x02C5A040: bl       #0x24cefec
  0x02C5A044: cbz      x0, #0x2c5a054
  0x02C5A048: mov      x1, xzr
  0x02C5A04C: bl       #0x24cf238
  0x02C5A050: and      w26, w0, #0xff
  0x02C5A054: mov      w1, #2
  0x02C5A058: mov      x0, x29
  0x02C5A05C: mov      x2, xzr
  0x02C5A060: bl       #0x24cefec
  0x02C5A064: cbz      x0, #0x2c5a078
  0x02C5A068: mov      x1, xzr
  0x02C5A06C: bl       #0x24cf238
  0x02C5A070: and      w25, w0, #0xff
  0x02C5A074: b        #0x2c5a07c
  0x02C5A078: mov      w25, #1
  0x02C5A07C: mov      w1, #3
  0x02C5A080: mov      x0, x29
  0x02C5A084: mov      x2, xzr
  0x02C5A088: bl       #0x24cefec
  0x02C5A08C: cbz      x0, #0x2c5a0a0
  0x02C5A090: mov      x1, xzr
  0x02C5A094: bl       #0x24cf238
  0x02C5A098: and      w29, w0, #0xff
  0x02C5A09C: b        #0x2c5a0a4
  0x02C5A0A0: mov      w29, #1
  0x02C5A0A4: add      w8, w24, w20
  0x02C5A0A8: cmp      w8, #0x7d1
  0x02C5A0AC: scvtf    s0, w8
  0x02C5A0B0: b.ge     #0x2c5a0c4
  0x02C5A0B4: mov      w8, #0x447a0000
  0x02C5A0B8: fmov     s1, w8
  0x02C5A0BC: fdiv     s8, s0, s1
  0x02C5A0C0: b        #0x2c5a0fc
  0x02C5A0C4: adrp     x8, #0x1056000
  0x02C5A0C8: ldr      s1, [x8, #0x61c]
  0x02C5A0CC: mov      w8, #-0x3b060000
  0x02C5A0D0: fmov     s3, w8
  0x02C5A0D4: fadd     s0, s0, s3
  0x02C5A0D8: fmov     s2, #1.00000000
  0x02C5A0DC: fdiv     s0, s0, s1
  0x02C5A0E0: fmin     s0, s0, s2
  0x02C5A0E4: fsub     s0, s2, s0
  0x02C5A0E8: fmul     s0, s0, s0
  0x02C5A0EC: fsub     s0, s2, s0
  0x02C5A0F0: fadd     s0, s0, s0
  0x02C5A0F4: fmov     s1, #2.50000000
  0x02C5A0F8: fadd     s8, s0, s1
  0x02C5A0FC: ldr      w24, [sp, #0x20]
  0x02C5A100: fmov     s0, w19
  0x02C5A104: mov      w1, #8
  0x02C5A108: mov      x0, x23
  0x02C5A10C: mov      x2, xzr
  0x02C5A110: add      w20, w22, w21
  0x02C5A114: str      q0, [sp, #0x20]
  0x02C5A118: bl       #0x27e7654
  0x02C5A11C: fmov     s10, wzr
  0x02C5A120: fmov     s9, wzr
  0x02C5A124: cbz      x0, #0x2c5a13c
  0x02C5A128: ldrb     w8, [x0, #0x58]
  0x02C5A12C: mov      w9, #0x64
  0x02C5A130: mul      w8, w8, w9
  0x02C5A134: add      w8, w8, #0x12c
  0x02C5A138: scvtf    s9, w8
  0x02C5A13C: ldr      q0, [sp, #0x20]
  0x02C5A140: mov      w1, #9
  0x02C5A144: mov      x0, x23
  0x02C5A148: mov      x2, xzr
  0x02C5A14C: mov      v0.s[1], w20
  0x02C5A150: str      q0, [sp, #0x20]
  0x02C5A154: bl       #0x27e7654
  0x02C5A158: cbz      x0, #0x2c5a184
  0x02C5A15C: mov      x1, xzr
  0x02C5A160: mov      x19, x0
  0x02C5A164: bl       #0x230eb54
  0x02C5A168: ldrb     w8, [x19, #0x58]
  0x02C5A16C: and      w9, w0, #0xff
  0x02C5A170: mov      w10, #0x32
  0x02C5A174: mul      w9, w9, w10
  0x02C5A178: mov      w10, #0x64
  0x02C5A17C: madd     w8, w8, w10, w9
  0x02C5A180: scvtf    s10, w8
  0x02C5A184: adrp     x21, #0x5955000
  0x02C5A188: ldr      w9, [sp, #0x38]
  0x02C5A18C: ldr      w10, [sp, #0x1c]
  0x02C5A190: ldrb     w8, [x21, #0x8ff]
  0x02C5A194: ldr      w19, [x23, #0x58]
  0x02C5A198: add      w20, w10, w9
  0x02C5A19C: cbnz     w8, #0x2c5a1b4
  0x02C5A1A0: adrp     x0, #0x550f000
  0x02C5A1A4: ldr      x0, [x0, #0xb00]
  0x02C5A1A8: bl       #0x2184724
  0x02C5A1AC: mov      w8, #1
  0x02C5A1B0: strb     w8, [x21, #0x8ff]
  0x02C5A1B4: adrp     x8, #0x550f000
  0x02C5A1B8: ldr      x8, [x8, #0xb00]
  0x02C5A1BC: ldr      q0, [sp, #0x20]
  0x02C5A1C0: ldr      w9, [sp, #0x18]
  0x02C5A1C4: scvtf    s12, w20
  0x02C5A1C8: ldr      x0, [x8]
  0x02C5A1CC: scvtf    v13.2s, v0.2s
  0x02C5A1D0: scvtf    s11, w28
  0x02C5A1D4: scvtf    s14, w9
  0x02C5A1D8: ldr      w8, [x0, #0xe0]
  0x02C5A1DC: cbnz     w8, #0x2c5a1e4
  0x02C5A1E0: bl       #0x218489c
  0x02C5A1E4: ldr      w8, [sp, #0x3c]
  0x02C5A1E8: ldp      w12, w11, [sp, #0x10]
  0x02C5A1EC: fmov     s3, #1.50000000
  0x02C5A1F0: mov      w10, #0x42480000
  0x02C5A1F4: scvtf    s2, w8
  0x02C5A1F8: scvtf    s4, w27
  0x02C5A1FC: ldr      w13, [sp, #0xc]
  0x02C5A200: fmul     s2, s2, s3
  0x02C5A204: fmov     s3, w10
  0x02C5A208: mov      w10, #0x43fa0000
  0x02C5A20C: scvtf    s5, w11
  0x02C5A210: fdiv     s3, s4, s3
  0x02C5A214: fmov     s4, w10
  0x02C5A218: mov      w10, #0x42f00000
  0x02C5A21C: mov      w11, #0x43020000
  0x02C5A220: scvtf    s6, w12
  0x02C5A224: fmul     s4, s5, s4
  0x02C5A228: fmov     s5, w10
  0x02C5A22C: fmul     s5, s6, s5
  0x02C5A230: fmov     s6, w11
  0x02C5A234: mov      w11, #0x43480000
  0x02C5A238: mov      w9, #0x447a0000
  0x02C5A23C: adrp     x8, #0x1056000
  0x02C5A240: add      w13, w13, w26
  0x02C5A244: fadd     s4, s4, s5
  0x02C5A248: dup      v5.2s, w11
  0x02C5A24C: scvtf    s1, w24
  0x02C5A250: fmov     s7, w9
  0x02C5A254: ldr      s16, [x8, #0x6a4]
  0x02C5A258: mov      w8, #0x42c80000
  0x02C5A25C: add      w11, w13, w25
  0x02C5A260: fadd     v5.2s, v13.2s, v5.2s
  0x02C5A264: fadd     s1, s1, s7
  0x02C5A268: fadd     s2, s2, s7
  0x02C5A26C: fmov     v7.2s, #0.25000000
  0x02C5A270: fdiv     v5.2s, v13.2s, v5.2s
  0x02C5A274: fmov     s17, w8
  0x02C5A278: add      w8, w11, w29
  0x02C5A27C: adrp     x12, #0x1056000
  0x02C5A280: fmul     v5.2s, v5.2s, v7.2s
  0x02C5A284: scvtf    s7, w8
  0x02C5A288: fmul     s7, s7, s17
  0x02C5A28C: ldr      s17, [x12, #0x4ac]
  0x02C5A290: fadd     s6, s14, s6
  0x02C5A294: adrp     x14, #0x1056000
  0x02C5A298: fdiv     s6, s14, s6
  0x02C5A29C: adrp     x8, #0x1056000
  0x02C5A2A0: fmul     s6, s6, s17
  0x02C5A2A4: ldr      s17, [x8, #0x5f8]
  0x02C5A2A8: fadd     s4, s4, s7
  0x02C5A2AC: ldr      s7, [x14, #0x514]
  0x02C5A2B0: fmul     s1, s1, s16
  0x02C5A2B4: fmul     s2, s2, s16
  0x02C5A2B8: fmov     v16.2s, #1.00000000
  0x02C5A2BC: fmov     s0, #1.00000000
  0x02C5A2C0: adrp     x9, #0x1056000
  0x02C5A2C4: cmp      w19, #0
  0x02C5A2C8: fadd     v5.2s, v5.2s, v16.2s
  0x02C5A2CC: fmov     s16, wzr
  0x02C5A2D0: adrp     x10, #0x1056000
  0x02C5A2D4: fcsel    s16, s16, s17, eq
  0x02C5A2D8: ldr      s17, [x9, #0x3c0]
  0x02C5A2DC: fadd     s3, s3, s0
  0x02C5A2E0: fadd     s0, s6, s0
  0x02C5A2E4: fadd     s6, s12, s7
  0x02C5A2E8: fdiv     s6, s7, s6
  0x02C5A2EC: ldr      s7, [x10, #0x530]
  0x02C5A2F0: fmul     s1, s1, s11
  0x02C5A2F4: fmul     s1, s1, s8
  0x02C5A2F8: fmul     s6, s6, s17
  0x02C5A2FC: fmul     s1, s2, s1
  0x02C5A300: fadd     s2, s6, s7
  0x02C5A304: fmul     s1, s3, s1
  0x02C5A308: fmul     s2, s2, s12
  0x02C5A30C: fmul     s0, s0, s1
  0x02C5A310: fmov     s3, #0.12500000
  0x02C5A314: fmul     s1, s2, v5.s[1]
  0x02C5A318: fadd     s0, s0, s11
  0x02C5A31C: fmul     s1, s1, v5.s[0]
  0x02C5A320: fmul     s0, s0, s3
  0x02C5A324: fadd     s0, s1, s0
  0x02C5A328: fadd     s0, s4, s0
  0x02C5A32C: fadd     s0, s0, s9
  0x02C5A330: fadd     s0, s0, s10
  0x02C5A334: mov      w8, #0x7f800000
  0x02C5A338: fadd     s0, s0, s16
  0x02C5A33C: ldp      x20, x19, [sp, #0xc0]
  0x02C5A340: ldp      x22, x21, [sp, #0xb0]
  0x02C5A344: ldp      x24, x23, [sp, #0xa0]
  0x02C5A348: ldp      x26, x25, [sp, #0x90]
  0x02C5A34C: ldp      x28, x27, [sp, #0x80]
  0x02C5A350: ldp      x29, x30, [sp, #0x70]
  0x02C5A354: ldp      d9, d8, [sp, #0x60]
  0x02C5A358: ldp      d11, d10, [sp, #0x50]
  0x02C5A35C: ldp      d13, d12, [sp, #0x40]
  0x02C5A360: ldr      d14, [sp, #0x30]
  0x02C5A364: fmov     s6, w8
  0x02C5A368: frintm   s1, s0
  0x02C5A36C: fcvtms   w8, s0
  0x02C5A370: fcmp     s1, s6
  0x02C5A374: mov      w9, #-0xffffffff80000000
  0x02C5A378: csel     w0, w9, w8, eq
  0x02C5A37C: add      sp, sp, #0xd0
  0x02C5A380: ret      
  0x02C5A384: bl       #0x21849c0
